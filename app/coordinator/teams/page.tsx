import { requireAnyRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CoordinatorTeamsDirectory, {
  type CoordinatorTeamItem,
} from '@/components/CoordinatorTeamsDirectory';

export default async function CoordinatorTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) redirect('/login');

  const q = await searchParams;
  const cycles = await query<any>(
    `SELECT pc.id, pc.semester, pc.team_min_size, pc.team_max_size, ac.name, pr.code program_code
     FROM pbl_cycles_v2 pc
     JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id
     JOIN programs_v2 pr ON pr.id = pc.program_id
     LEFT JOIN pbl_coordinator_assignments_v2 ca ON ca.id = pc.coordinator_assignment_id
     WHERE $1::boolean OR ca.faculty_id = $2
     ORDER BY pr.code, pc.semester`,
    [u.roles.includes('HOD'), u.facultyId || null]
  );

  const cycleId = Number(q.cycle || cycles[0]?.id || 0);
  const selectedCycle = cycles.find((c) => c.id === cycleId);

  let teams: CoordinatorTeamItem[] = [];
  let availableSections: string[] = [];
  let unassignedCount = 0;

  if (selectedCycle) {
    // Fetch teams with sections
    teams = await query<CoordinatorTeamItem>(
      `SELECT t.id, t.team_code, t.team_name, t.status, t.created_at,
              ls.name leader_name, ls.usn leader_usn,
              COUNT(tm.id) member_count,
              STRING_AGG(s.name || ' (' || s.usn || ' - Sec ' || se.code || ')', ' | ' ORDER BY (tm.member_role = 'LEADER') DESC, s.name) members_summary,
              COALESCE(STRING_AGG(DISTINCT se.code, ', ' ORDER BY se.code), '') sections,
              MAX(p.title) project_title,
              MAX(f.name) guide_name
       FROM teams_v2 t
       JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
       LEFT JOIN team_members_v2 tm ON tm.team_id = t.id
       LEFT JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
       LEFT JOIN students_v2 s ON s.id = e.student_id
       LEFT JOIN sections_v2 se ON se.id = e.section_id
       LEFT JOIN student_enrollments_v2 le ON le.id = t.leader_enrollment_id
       LEFT JOIN students_v2 ls ON ls.id = le.student_id
       LEFT JOIN project_allocations_v2 pa ON pa.team_id = t.id AND pa.status = 'ACTIVE'
       LEFT JOIN projects_v2 p ON p.id = pa.project_id
       LEFT JOIN faculty_v2 f ON f.id = pa.guide_faculty_id
       WHERE t.pbl_cycle_id = $1
       GROUP BY t.id, t.team_code, t.team_name, t.status, t.created_at, ls.name, ls.usn
       ORDER BY t.team_code ASC`,
      [cycleId]
    );

    // Fetch available sections for this cycle
    const sectionsRes = await query<{ code: string }>(
      `SELECT DISTINCT se.code
       FROM sections_v2 se
       JOIN pbl_cycles_v2 pc ON pc.academic_cycle_id = se.academic_cycle_id AND pc.program_id = se.program_id AND pc.semester = se.semester
       WHERE pc.id = $1
       ORDER BY se.code`,
      [cycleId]
    );
    availableSections = sectionsRes.map((r) => r.code);

    // If no sections directly joined from cycle, also add any sections present in the teams
    const teamSections = Array.from(
      new Set(
        teams
          .map((t) => t.sections)
          .filter(Boolean)
          .flatMap((s) => s.split(',').map((x) => x.trim()))
      )
    ).sort();
    for (const sec of teamSections) {
      if (!availableSections.includes(sec)) {
        availableSections.push(sec);
      }
    }
    availableSections.sort();

    // Fetch unassigned students count
    const unassignedRes = await query<any>(
      `SELECT COUNT(e.id)::int unassigned_count
       FROM student_enrollments_v2 e
       LEFT JOIN team_members_v2 tm ON tm.enrollment_id = e.id AND tm.pbl_cycle_id = $1
       WHERE e.academic_cycle_id = (SELECT academic_cycle_id FROM pbl_cycles_v2 WHERE id = $1)
         AND e.program_id = (SELECT program_id FROM pbl_cycles_v2 WHERE id = $1)
         AND e.semester = (SELECT semester FROM pbl_cycles_v2 WHERE id = $1)
         AND tm.id IS NULL`,
      [cycleId]
    );
    unassignedCount = unassignedRes[0]?.unassigned_count || 0;
  }

  const totalAssignedStudents = teams.reduce(
    (acc, t) => acc + Number(t.member_count || 0),
    0
  );

  return (
    <section className="section">
      <div className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Team Management</h1>
            <p className="lead" style={{ margin: '0.25rem 0 0' }}>
              Create teams, edit team names, assign leaders, and add or remove team members.
            </p>
          </div>
          {selectedCycle && (
            <Link
              href={`/coordinator/teams/new?cycle=${cycleId}`}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
              }}
            >
              Create New Team
            </Link>
          )}
        </div>

        {/* PBL Cycle Selector */}
        <form
          method="get"
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          <label style={{ fontWeight: 600 }}>Select PBL Cycle / Semester:</label>
          <select
            name="cycle"
            defaultValue={cycleId}
            style={{ minWidth: '280px', padding: '0.5rem 0.75rem' }}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.program_code === 'GMIT-CSE' ? '[GMIT] ' : '[GMU] '}
                {c.name} — Semester {c.semester}
              </option>
            ))}
          </select>
          <button className="btn secondary">Load Cycle</button>
        </form>

        {selectedCycle && (
          <CoordinatorTeamsDirectory
            teams={teams}
            selectedCycle={selectedCycle}
            availableSections={availableSections}
            unassignedCount={unassignedCount}
            totalAssignedStudents={totalAssignedStudents}
          />
        )}
      </div>
    </section>
  );
}
