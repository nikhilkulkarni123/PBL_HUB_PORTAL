import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';
import { submissionDateBounds } from '@/lib/review-dates';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) return NextResponse.redirect(new URL('/login', req.url), 303);

  const { id } = await params;
  const rid = Number(id);

  const f = await req.formData();
  const reviewName = String(f.get('reviewName') || '').trim();
  const subjectCode = String(f.get('subjectCode') || '').trim();
  const title = String(f.get('title') || '').trim();
  const startDate = String(f.get('submissionStartDate') || '').trim();
  const lastDate = String(f.get('submissionLastDate') || '').trim();
  const rubricJson = JSON.parse(String(f.get('rubricJson') || '{"items":[]}'));
  const items = Array.isArray(rubricJson.items) ? rubricJson.items : [];

  if (!reviewName) return new NextResponse('Review name is required', { status: 400 });
  if (!title) return new NextResponse('Rubric title is required', { status: 400 });
  if (!items.length) return new NextResponse('At least one criterion is required', { status: 400 });

  let dates;
  try {
    dates = submissionDateBounds(startDate, lastDate);
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : 'Invalid submission dates', { status: 400 });
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
      if (!ok) throw new Error('Not authorised for this review');
    }

    const rub = (await c.query(`SELECT * FROM rubrics_v2 WHERE review_id=$1 FOR UPDATE`, [rid])).rows[0];
    if (!rub) throw new Error('Rubric not found for this review');

    const total = items.reduce((s: number, x: any) => s + Number(x.maxMarks || 0), 0);

    // Update review and rubric totals
    await c.query(`
      UPDATE pbl_reviews_v2
      SET name=$1, subject_code=$2, submission_open_at=$3, submission_deadline=$4, maximum_marks=$5
      WHERE id=$6
    `, [reviewName, subjectCode, dates.openAt, dates.deadline, total, rid]);

    await c.query(`
      UPDATE rubrics_v2
      SET title=$1, total_marks=$2
      WHERE id=$3
    `, [title, total, rub.id]);

    // Query existing items
    const existingItems = (await c.query(`SELECT id, criterion_name FROM rubric_items_v2 WHERE rubric_id=$1`, [rub.id])).rows;
    const existingItemIds = new Set(existingItems.map((r: any) => Number(r.id)));
    const keptItemIds = new Set<number>();

    // Temporarily negate display_order on existing items to avoid UNIQUE(rubric_id, display_order) conflicts
    if (existingItems.length > 0) {
      await c.query(`UPDATE rubric_items_v2 SET display_order = -display_order WHERE rubric_id=$1`, [rub.id]);
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let itemId: number;

      if (it.id && existingItemIds.has(Number(it.id))) {
        itemId = Number(it.id);
        await c.query(`
          UPDATE rubric_items_v2
          SET co_code=$1, criterion_name=$2, max_marks=$3, display_order=$4
          WHERE id=$5
        `, [it.co || null, it.name, Number(it.maxMarks || 0), i + 1, itemId]);
        keptItemIds.add(itemId);
      } else {
        const res = await c.query(`
          INSERT INTO rubric_items_v2(rubric_id, co_code, criterion_name, max_marks, display_order)
          VALUES($1, $2, $3, $4, $5)
          RETURNING id
        `, [rub.id, it.co || null, it.name, Number(it.maxMarks || 0), i + 1]);
        itemId = res.rows[0].id;
      }

      // Process levels for this criterion
      const levels = Array.isArray(it.levels) ? it.levels : [];
      const existingLevels = (await c.query(`SELECT id, level_label FROM rubric_levels_v2 WHERE rubric_item_id=$1`, [itemId])).rows;
      const existingLevelIds = new Set(existingLevels.map((l: any) => Number(l.id)));
      const keptLevelIds = new Set<number>();

      if (existingLevels.length > 0) {
        await c.query(`UPDATE rubric_levels_v2 SET display_order = -display_order WHERE rubric_item_id=$1`, [itemId]);
      }

      for (let j = 0; j < levels.length; j++) {
        const lvl = levels[j];
        if (lvl.id && existingLevelIds.has(Number(lvl.id))) {
          await c.query(`
            UPDATE rubric_levels_v2
            SET level_label=$1, marks=$2, descriptor=$3, display_order=$4
            WHERE id=$5
          `, [lvl.label, Number(lvl.marks || 0), lvl.descriptor || '', j + 1, Number(lvl.id)]);
          keptLevelIds.add(Number(lvl.id));
        } else {
          await c.query(`
            INSERT INTO rubric_levels_v2(rubric_item_id, level_label, marks, descriptor, display_order)
            VALUES($1, $2, $3, $4, $5)
          `, [itemId, lvl.label, Number(lvl.marks || 0), lvl.descriptor || '', j + 1]);
        }
      }

      // Delete removed levels
      for (const oldLvl of existingLevels) {
        const lvlId = Number(oldLvl.id);
        if (!keptLevelIds.has(lvlId)) {
          const used = (await c.query(`SELECT COUNT(*)::int as count FROM team_rubric_scores_v3 WHERE selected_level_id=$1`, [lvlId])).rows[0].count;
          if (used > 0) {
            throw new Error(`Cannot delete level "${oldLvl.level_label}" because evaluations have already been recorded with it.`);
          }
          await c.query(`DELETE FROM rubric_levels_v2 WHERE id=$1`, [lvlId]);
        }
      }
    }

    // Delete removed items
    for (const oldIt of existingItems) {
      const itId = Number(oldIt.id);
      if (!keptItemIds.has(itId)) {
        const used = (await c.query(`SELECT COUNT(*)::int as count FROM team_rubric_scores_v3 WHERE rubric_item_id=$1`, [itId])).rows[0].count;
        if (used > 0) {
          throw new Error(`Cannot delete criterion "${oldIt.criterion_name}" because evaluations have already been recorded with it.`);
        }
        await c.query(`DELETE FROM rubric_levels_v2 WHERE rubric_item_id=$1`, [itId]);
        await c.query(`DELETE FROM rubric_items_v2 WHERE id=$1`, [itId]);
      }
    }

    // Handle action
    const action = String(f.get('action') || 'SAVE');
    if (action === 'PUBLISH' && rv.status !== 'PUBLISHED') {
      await c.query(`UPDATE pbl_reviews_v2 SET status='PUBLISHED' WHERE id=$1`, [rid]);
      await c.query(`UPDATE rubrics_v2 SET status='PUBLISHED', published_at=NOW() WHERE id=$1`, [rub.id]);
    }

    await c.query('COMMIT');
    return NextResponse.redirect(new URL('/coordinator/rubrics', req.url), 303);
  } catch (e) {
    await c.query('ROLLBACK');
    return new NextResponse(e instanceof Error ? e.message : 'Unable to update review & rubric', { status: 400 });
  } finally {
    c.release();
  }
}
