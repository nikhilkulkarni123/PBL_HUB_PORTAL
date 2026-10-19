import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';
import { normalizeExtensions, DANGEROUS_EXTENSIONS } from '@/lib/review-submissions';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) return NextResponse.redirect(new URL('/login', req.url), 303);
  const { id } = await params;
  const rid = Number(id);
  const f = await req.formData();
  const data = JSON.parse(String(f.get('requirementsJson') || '{}'));
  const rows = Array.isArray(data.requirements) ? data.requirements : [];

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rv = (await c.query(`SELECT rv.*, pc.coordinator_assignment_id FROM pbl_reviews_v2 rv JOIN pbl_cycles_v2 pc ON pc.id=rv.pbl_cycle_id WHERE rv.id=$1 FOR UPDATE`, [rid])).rows[0];
    if (!rv) throw new Error('Review not found');

    if (!u.roles.includes('HOD')) {
      const ok = (await c.query(`SELECT 1 FROM pbl_coordinator_assignments_v2 WHERE id=$1 AND faculty_id=$2 AND is_active`, [rv.coordinator_assignment_id, u.facultyId])).rowCount;
      if (!ok) throw new Error('Not authorised');
    }

    // Get current requirements for this review
    const existingRows = (await c.query(`SELECT id FROM review_file_requirements_v4 WHERE review_id=$1`, [rid])).rows;
    const existingIds = new Set(existingRows.map((r: any) => Number(r.id)));
    const keptIds = new Set<number>();

    // Temporarily negate display_order on existing rows to avoid UNIQUE(review_id, display_order) collisions
    if (existingRows.length > 0) {
      await c.query(`UPDATE review_file_requirements_v4 SET display_order = -display_order WHERE review_id=$1`, [rid]);
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const type = String(r.type || 'OTHER').toUpperCase();
      if (!['PDF', 'PPT', 'DOC', 'ZIP', 'IMAGE', 'CSV', 'EXCEL', 'URL', 'SOURCE_CODE', 'OTHER'].includes(type)) {
        throw new Error('Unsupported type');
      }
      const exts = normalizeExtensions(r.extensions);
      if (exts.some(x => DANGEROUS_EXTENSIONS.has(x))) {
        throw new Error('Dangerous executable extensions are not permitted');
      }
      const maxSize = Math.round(Math.max(0.1, Math.min(1, Number(r.maxSizeMB || 1))) * 1024 * 1024);
      const maxFiles = Math.max(1, Math.min(10, Number(r.maxFiles || 1)));
      const urlKind = type === 'URL' ? (r.urlKind === 'YOUTUBE' ? 'YOUTUBE' : 'ANY') : null;
      const customType = type === 'OTHER' ? String(r.customType || 'Other') : null;

      if (r.id && existingIds.has(Number(r.id))) {
        // Update existing requirement to preserve student submission files
        await c.query(`UPDATE review_file_requirements_v4 SET
          requirement_type=$1, title=$2, description=$3, is_required=$4, max_size_bytes=$5, allowed_extensions=$6,
          max_files=$7, instructions=$8, url_kind=$9, custom_type=$10, display_order=$11
          WHERE id=$12 AND review_id=$13`, [
          type, String(r.title || `Requirement ${i + 1}`), String(r.description || ''), !!r.required,
          maxSize, exts, maxFiles, String(r.instructions || ''), urlKind, customType, i + 1,
          Number(r.id), rid
        ]);
        keptIds.add(Number(r.id));
      } else {
        // Insert new requirement
        await c.query(`INSERT INTO review_file_requirements_v4(
          review_id, requirement_type, title, description, is_required, max_size_bytes, allowed_extensions,
          max_files, instructions, url_kind, custom_type, display_order
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
          rid, type, String(r.title || `Requirement ${i + 1}`), String(r.description || ''), !!r.required,
          maxSize, exts, maxFiles, String(r.instructions || ''), urlKind, customType, i + 1
        ]);
      }
    }

    // Delete removed requirements
    for (const oldId of existingIds) {
      if (!keptIds.has(oldId)) {
        await c.query(`DELETE FROM review_file_requirements_v4 WHERE id=$1 AND review_id=$2`, [oldId, rid]);
      }
    }

    await c.query('COMMIT');
    return NextResponse.redirect(new URL('/coordinator/rubrics', req.url), 303);
  } catch (e) {
    await c.query('ROLLBACK');
    return new NextResponse(e instanceof Error ? e.message : 'Unable to update requirements', { status: 400 });
  } finally {
    c.release();
  }
}
