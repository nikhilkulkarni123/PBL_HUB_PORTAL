import { requireAnyRole } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { query } from '@/lib/db';
import ReviewEditor, { ReviewData, Item } from '@/components/rubric/ReviewEditor';
import { toDateInputValue } from '@/lib/review-dates';

export default async function EditReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) redirect('/login');

  const { id } = await params;
  const rid = Number(id);

  const rv = (await query<any>(`
    SELECT rv.*, pc.coordinator_assignment_id, pc.semester, pr.code as program_code, pr.name as program_name,
      (SELECT COUNT(*) FROM review_file_requirements_v4 rfr WHERE rfr.review_id=rv.id)::int requirement_count
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

  const rub = (await query<any>(`
    SELECT * FROM rubrics_v2 WHERE review_id=$1
  `, [rid]))[0];

  if (!rub) notFound();

  const rawItems = await query<any>(`
    SELECT ri.id, ri.co_code, ri.criterion_name, ri.max_marks, ri.display_order,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', rl.id,
            'label', rl.level_label,
            'marks', rl.marks,
            'descriptor', rl.descriptor,
            'order', rl.display_order
          ) ORDER BY rl.display_order
        ) FILTER (WHERE rl.id IS NOT NULL),
        '[]'::jsonb
      ) levels
    FROM rubric_items_v2 ri
    LEFT JOIN rubric_levels_v2 rl ON rl.rubric_item_id=ri.id
    WHERE ri.rubric_id=$1
    GROUP BY ri.id
    ORDER BY ri.display_order
  `, [rub.id]);

  const items: Item[] = rawItems.map((r: any) => ({
    id: r.id,
    co: r.co_code || '',
    name: r.criterion_name,
    maxMarks: Number(r.max_marks || 0),
    levels: (Array.isArray(r.levels) ? r.levels : []).map((l: any) => ({
      id: l.id,
      label: l.label,
      marks: Number(l.marks || 0),
      descriptor: l.descriptor || ''
    }))
  }));

  const reviewData: ReviewData = {
    id: rv.id,
    name: rv.name,
    subjectCode: rv.subject_code || '',
    semester: rv.semester,
    programCode: rv.program_code,
    status: rv.status,
    startDate: toDateInputValue(rv.submission_open_at),
    lastDate: toDateInputValue(rv.submission_deadline),
    rubricTitle: rub.title,
    requirementCount: rv.requirement_count || 0
  };

  return (
    <section className="section">
      <div className="container">
        <ReviewEditor review={reviewData} initialItems={items} />
      </div>
    </section>
  );
}
