import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';
import { submissionDateBounds } from '@/lib/review-dates';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) {
    if (req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  const { id } = await params;
  const rid = Number(id);

  let startDate = '';
  let lastDate = '';
  const contentType = req.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      const body = await req.json();
      startDate = String(body.submissionStartDate || '').trim();
      lastDate = String(body.submissionLastDate || '').trim();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
  } else {
    const f = await req.formData();
    startDate = String(f.get('submissionStartDate') || '').trim();
    lastDate = String(f.get('submissionLastDate') || '').trim();
  }

  let dates;
  try {
    dates = submissionDateBounds(startDate, lastDate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid submission dates';
    if (isJson || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return new NextResponse(msg, { status: 400 });
  }

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rv = (await c.query(`
      SELECT rv.*, pc.coordinator_assignment_id
      FROM pbl_reviews_v2 rv
      JOIN pbl_cycles_v2 pc ON pc.id=rv.pbl_cycle_id
      WHERE rv.id=$1 FOR UPDATE
    `, [rid])).rows[0];

    if (!rv) throw new Error('Review not found');

    if (!u.roles.includes('HOD')) {
      const ok = (await c.query(`
        SELECT 1 FROM pbl_coordinator_assignments_v2
        WHERE id=$1 AND faculty_id=$2 AND is_active
      `, [rv.coordinator_assignment_id, u.facultyId])).rowCount;
      if (!ok) throw new Error('Not authorised for this semester review');
    }

    await c.query(`
      UPDATE pbl_reviews_v2
      SET submission_open_at=$1, submission_deadline=$2
      WHERE id=$3
    `, [dates.openAt, dates.deadline, rid]);

    await c.query('COMMIT');

    if (isJson || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({
        ok: true,
        message: 'Submission dates updated successfully',
        openAt: dates.openAt,
        deadline: dates.deadline
      });
    }

    return NextResponse.redirect(new URL('/coordinator/rubrics', req.url), 303);
  } catch (e) {
    await c.query('ROLLBACK');
    const msg = e instanceof Error ? e.message : 'Unable to update submission dates';
    if (isJson || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return new NextResponse(msg, { status: 400 });
  } finally {
    c.release();
  }
}
