import { requireAnyRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import RubricDesigner from '@/components/rubric/RubricDesigner';
import ExistingReviewsTable, { ReviewRow } from '@/components/rubric/ExistingReviewsTable';

export default async function Rubrics() {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) redirect('/login');

  const cycles = await query<any>(`
    SELECT pc.id, pc.semester, ac.name, pr.code as program_code, pr.name as program_name
    FROM pbl_cycles_v2 pc
    JOIN academic_cycles_v2 ac ON ac.id=pc.academic_cycle_id
    JOIN programs_v2 pr ON pr.id=pc.program_id
    LEFT JOIN pbl_coordinator_assignments_v2 ca ON ca.id=pc.coordinator_assignment_id
    WHERE $1::boolean OR ca.faculty_id=$2
    ORDER BY pr.code, pc.semester
  `, [u.roles.includes('HOD'), u.facultyId || null]);

  const ids = cycles.map(c => c.id);

  const existing: ReviewRow[] = ids.length ? await query<any>(`
    SELECT rv.id, rv.name, rv.maximum_marks, rv.status, rv.submission_open_at, rv.submission_deadline,
      pc.semester, r.title, pr.code as program_code,
      (SELECT COUNT(*) FROM review_file_requirements_v4 rfr WHERE rfr.review_id=rv.id)::int requirement_count
    FROM pbl_reviews_v2 rv
    JOIN pbl_cycles_v2 pc ON pc.id=rv.pbl_cycle_id
    JOIN programs_v2 pr ON pr.id=pc.program_id
    LEFT JOIN rubrics_v2 r ON r.review_id=rv.id
    WHERE rv.pbl_cycle_id=ANY($1::int[])
    ORDER BY pr.code, pc.semester, rv.sequence_no
  `, [ids]) : [];

  return (
    <section className="section">
      <div className="container">
        <RubricDesigner cycles={cycles} />
        <div style={{ marginTop: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>Existing Reviews</h2>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Coordinators can edit criteria, adjust submission files, or extend submission dates at any time.
            </span>
          </div>
          <ExistingReviewsTable reviews={existing} />
        </div>
      </div>
    </section>
  );
}
