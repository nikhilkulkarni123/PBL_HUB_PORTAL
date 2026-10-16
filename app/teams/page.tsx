import { query } from '@/lib/db';
import { getDirectoryFilterMeta } from '@/lib/filter-options';
import TeamsDirectory, { type TeamRow } from '@/components/TeamsDirectory';

export default async function TeamsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    institution?: string;
    sem?: string;
    section?: string;
    q?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : {};

  const [rows, filterMeta] = await Promise.all([
    query<TeamRow>(`
      SELECT 
        t.id,
        t.team_code,
        t.team_name,
        CASE WHEN prog.code LIKE 'GMIT%' THEN 'GMIT' ELSE 'GMU' END AS institution,
        pc.semester,
        COALESCE(STRING_AGG(DISTINCT se.code, ', ' ORDER BY se.code), '—') AS sections,
        t.status,
        COALESCE(STRING_AGG(s.name, ', ' ORDER BY s.name), '—') AS members,
        MAX(p.title) AS project_title,
        MAX(f.name) AS guide_name,
        MAX(cf.name) AS coordinator_name
      FROM teams_v2 t
      JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
      JOIN programs_v2 prog ON prog.id = pc.program_id
      LEFT JOIN team_members_v2 tm ON tm.team_id = t.id
      LEFT JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
      LEFT JOIN students_v2 s ON s.id = e.student_id
      LEFT JOIN sections_v2 se ON se.id = e.section_id
      LEFT JOIN project_allocations_v2 pa ON pa.team_id = t.id AND pa.status = 'ACTIVE'
      LEFT JOIN projects_v2 p ON p.id = pa.project_id
      LEFT JOIN faculty_v2 f ON f.id = pa.guide_faculty_id
      LEFT JOIN pbl_coordinator_assignments_v2 ca ON ca.id = pc.coordinator_assignment_id
      LEFT JOIN faculty_v2 cf ON cf.id = ca.faculty_id
      GROUP BY t.id, pc.semester, prog.code
      ORDER BY institution, pc.semester, t.team_code
    `),
    getDirectoryFilterMeta(),
  ]);

  return (
    <section className="section">
      <div className="container">
        <h1>Public Team Directory</h1>
        <p className="lead">
          Browse student teams across GMU and GMIT. Filter by Institution, Semester, and Section to find teams, assigned projects, and guides.
        </p>

        <TeamsDirectory
          initialRows={rows}
          filterMeta={filterMeta}
          initialParams={params}
        />
      </div>
    </section>
  );
}
