import { requireAnyRole } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { query } from '@/lib/db';
import RequiredFilesEditor from '@/components/RequiredFilesEditor';
import Link from 'next/link';

export default async function EditReq({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) redirect('/login');
  const { id } = await params;
  const rid = Number(id);

  const rv = (await query<any>(`
    SELECT rv.*, pc.coordinator_assignment_id, pc.semester, pr.code as program_code
    FROM pbl_reviews_v2 rv
    JOIN pbl_cycles_v2 pc ON pc.id=rv.pbl_cycle_id
    JOIN programs_v2 pr ON pr.id=pc.program_id
    WHERE rv.id=$1
  `, [rid]))[0];
  if (!rv) notFound();

  if (!u.roles.includes('HOD')) {
    const ok = (await query<any>(`
      SELECT 1 FROM pbl_coordinator_assignments_v2
      WHERE id=$1 AND faculty_id=$2 AND is_active
    `, [rv.coordinator_assignment_id, u.facultyId || null])).length;
    if (!ok) redirect('/coordinator/rubrics');
  }

  const rows = await query<any>(`
    SELECT * FROM review_file_requirements_v4
    WHERE review_id=$1
    ORDER BY display_order
  `, [rid]);

  const initial = rows.map((r: any) => ({
    id: r.id,
    type: r.requirement_type,
    title: r.title,
    description: r.description || '',
    required: r.is_required,
    maxSizeMB: Number(r.max_size_bytes) / 1024 / 1024,
    extensions: (r.allowed_extensions || []).join(','),
    maxFiles: Number(r.max_files),
    instructions: r.instructions || '',
    urlKind: r.url_kind || 'ANY',
    customType: r.custom_type || ''
  }));

  const isPublished = rv.status === 'PUBLISHED';

  return (
    <section className="section">
      <div className="container">
        <div style={{ marginBottom: '16px' }}>
          <Link href="/coordinator/rubrics" className="btn secondary" style={{ fontSize: '13px', padding: '6px 12px' }}>
            ← Back to Rubrics & Reviews
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <h1 style={{ margin: 0 }}>Required Submission Files</h1>
          <span style={{
            fontSize: '12px',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: rv.program_code === 'GMIT-CSE' ? '#fef3c7' : '#e0f2fe',
            color: rv.program_code === 'GMIT-CSE' ? '#92400e' : '#0369a1'
          }}>
            {rv.program_code === 'GMIT-CSE' ? 'GMIT' : 'GMU'} Sem {rv.semester}
          </span>
          <span className="status" style={{
            background: isPublished ? '#e0f2fe' : '#fef3c7',
            color: isPublished ? '#0369a1' : '#92400e'
          }}>
            {rv.name} · {rv.status}
          </span>
        </div>

        {isPublished && (
          <div className="notice" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1e40af', margin: '14px 0' }}>
            ℹ️ <b>Review is PUBLISHED:</b> You can add new file requirements or update titles, descriptions, and file constraints. Any student files already submitted for existing requirements will be preserved.
          </div>
        )}

        <RequiredFilesEditor reviewId={rid} initial={initial} />
      </div>
    </section>
  );
}
