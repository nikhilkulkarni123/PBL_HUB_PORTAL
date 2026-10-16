import { query } from '@/lib/db';
import { getDirectoryFilterMeta } from '@/lib/filter-options';
import AllocationsDirectory, { type AllocationRow } from '@/components/AllocationsDirectory';

export default async function AllocationsPage({
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
    query<AllocationRow>(`
      SELECT 
        CASE WHEN prog.code LIKE 'GMIT%' THEN 'GMIT' ELSE 'GMU' END AS institution,
        pc.semester,
        COALESCE(STRING_AGG(DISTINCT se.code, ', ' ORDER BY se.code), '—') AS sections,
        t.team_code,
        t.team_name,
        p.title AS project_title,
        p.project_type,
        COALESCE(of.name, t.team_name) AS owner_name,
        g.name AS guide_name,
        pa.status
      FROM project_allocations_v2 pa
      JOIN teams_v2 t ON t.id = pa.team_id
      JOIN projects_v2 p ON p.id = pa.project_id
      JOIN pbl_cycles_v2 pc ON pc.id = p.pbl_cycle_id
      JOIN programs_v2 prog ON prog.id = pc.program_id
      LEFT JOIN team_members_v2 tm ON tm.team_id = t.id
      LEFT JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
      LEFT JOIN sections_v2 se ON se.id = e.section_id
      LEFT JOIN faculty_v2 of ON of.id = p.owner_faculty_id
      JOIN faculty_v2 g ON g.id = pa.guide_faculty_id
      WHERE pa.status = 'ACTIVE'
      GROUP BY t.id, t.team_code, t.team_name, p.title, p.project_type, of.name, g.name, pc.semester, prog.code, pa.status
      ORDER BY institution, pc.semester, t.team_code
    `),
    getDirectoryFilterMeta(),
  ]);

  return (
    <section className="section">
      <div className="container">
        <h1>Public Project Allocation Directory</h1>
        <p className="lead">
          Filter and explore project allocations by Institution (GMU / GMIT), Semester, and Section. Project ownership and technical guidance are shown separately.
        </p>

        <AllocationsDirectory
          initialRows={rows}
          filterMeta={filterMeta}
          initialParams={params}
        />
      </div>
    </section>
  );
}
