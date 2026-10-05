import { requireAnyRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import StudentTeamSelector, { FacultyGuide } from '@/components/StudentTeamSelector';

export default async function NewTeam({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
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
  const cycle = cycles.find((c) => c.id === cycleId);

  const students = cycle
    ? await query<any>(
        `SELECT e.id enrollment_id, s.usn, s.name, se.code section_code, f.name mentor_name
         FROM student_enrollments_v2 e
         JOIN students_v2 s ON s.id = e.student_id
         JOIN sections_v2 se ON se.id = e.section_id
         LEFT JOIN faculty_v2 f ON f.id = s.mentor_faculty_id
         LEFT JOIN team_members_v2 tm ON tm.enrollment_id = e.id AND tm.pbl_cycle_id = $1
         WHERE e.academic_cycle_id = (SELECT academic_cycle_id FROM pbl_cycles_v2 WHERE id = $1)
           AND e.program_id = (SELECT program_id FROM pbl_cycles_v2 WHERE id = $1)
           AND e.semester = (SELECT semester FROM pbl_cycles_v2 WHERE id = $1)
           AND tm.id IS NULL
         ORDER BY se.code, s.usn`,
        [cycleId]
      )
    : [];

  const facultyList = cycle
    ? await query<FacultyGuide>(
        `SELECT f.id, f.employee_id, f.name, f.designation, f.department,
                COALESCE(gl.overall_max_projects, 6)::int overall_max,
                COALESCE(sl.max_projects, 3)::int semester_max,
                (SELECT COUNT(*)::int FROM project_allocations_v2 pa JOIN projects_v2 p ON p.id = pa.project_id WHERE pa.guide_faculty_id = f.id AND p.pbl_cycle_id = $1 AND pa.status = 'ACTIVE') semester_load,
                (SELECT COUNT(*)::int FROM project_allocations_v2 pa JOIN projects_v2 p ON p.id = pa.project_id JOIN pbl_cycles_v2 pc ON pc.id = p.pbl_cycle_id WHERE pa.guide_faculty_id = f.id AND pc.academic_cycle_id = (SELECT academic_cycle_id FROM pbl_cycles_v2 WHERE id = $1) AND pa.status = 'ACTIVE') total_load
         FROM faculty_v2 f
         LEFT JOIN faculty_guide_limits_v2 gl ON gl.faculty_id = f.id AND gl.academic_cycle_id = (SELECT academic_cycle_id FROM pbl_cycles_v2 WHERE id = $1)
         LEFT JOIN faculty_semester_guide_limits_v2 sl ON sl.faculty_id = f.id AND sl.pbl_cycle_id = $1
         WHERE f.is_active = true
         ORDER BY f.name`,
        [cycleId]
      )
    : [];

  return (
    <section className="section">
      <div className="container">
        <h1>Create PBL Team</h1>
        <form method="get" className="card">
          <label>PBL Cycle / Semester </label>
          <select name="cycle" defaultValue={cycleId}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.program_code === 'GMIT-CSE' ? '[GMIT] ' : '[GMU] '}
                {c.name} — Semester {c.semester}
              </option>
            ))}
          </select>{' '}
          <button className="btn secondary">Load</button>
        </form>
        {cycle && (
          <div className="notice">
            Team rule: minimum <b>{cycle.team_min_size}</b>, maximum <b>{cycle.team_max_size}</b>. Students are restricted
            to this academic cycle and Semester {cycle.semester}; students already in a team are hidden.
          </div>
        )}
        {cycle && (
          <StudentTeamSelector
            students={students}
            facultyList={facultyList}
            pblCycleId={cycleId}
            semester={Number(cycle.semester)}
            minSize={Number(cycle.team_min_size) || 3}
            maxSize={Number(cycle.team_max_size) || 6}
          />
        )}
      </div>
    </section>
  );
}
