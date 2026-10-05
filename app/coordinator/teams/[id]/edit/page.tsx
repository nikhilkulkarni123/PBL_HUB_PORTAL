import { requireAnyRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import EditTeamForm, { TeamMember, AvailableStudent, FacultyGuide } from '@/components/EditTeamForm';

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) redirect('/login');

  const { id } = await params;
  const teamId = Number(id);
  if (!teamId || isNaN(teamId)) notFound();

  // Load team details with cycle info and current guide / project
  const teamRows = await query<any>(
    `SELECT t.id, t.team_code, t.team_name, t.leader_enrollment_id, t.pbl_cycle_id,
            pc.team_min_size, pc.team_max_size, pc.semester, pc.academic_cycle_id, pc.program_id,
            pc.coordinator_assignment_id, ac.name cycle_name, pr.code program_code,
            pa.guide_faculty_id, p.title project_title
     FROM teams_v2 t
     JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
     JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id
     JOIN programs_v2 pr ON pr.id = pc.program_id
     LEFT JOIN project_allocations_v2 pa ON pa.team_id = t.id AND pa.status = 'ACTIVE'
     LEFT JOIN projects_v2 p ON p.id = pa.project_id
     WHERE t.id = $1`,
    [teamId]
  );

  if (teamRows.length === 0) {
    notFound();
  }

  const teamRow = teamRows[0];

  // Authorization check for coordinator
  if (!u.roles.includes('HOD')) {
    const coordinatorCheck = await query<any>(
      `SELECT 1 FROM pbl_coordinator_assignments_v2 
       WHERE id = $1 AND faculty_id = $2 AND is_active`,
      [teamRow.coordinator_assignment_id, u.facultyId || null]
    );
    if (coordinatorCheck.length === 0) {
      redirect('/coordinator/teams');
    }
  }

  // Load current team members
  const memberRows = await query<TeamMember>(
    `SELECT tm.enrollment_id, s.usn, s.name, se.code section_code, f.name mentor_name, tm.member_role
     FROM team_members_v2 tm
     JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
     JOIN students_v2 s ON s.id = e.student_id
     JOIN sections_v2 se ON se.id = e.section_id
     LEFT JOIN faculty_v2 f ON f.id = s.mentor_faculty_id
     WHERE tm.team_id = $1
     ORDER BY tm.member_role DESC, s.name ASC`,
    [teamId]
  );

  // Load all available unassigned students for this PBL cycle
  const availableStudents = await query<AvailableStudent>(
    `SELECT e.id enrollment_id, s.usn, s.name, se.code section_code, f.name mentor_name
     FROM student_enrollments_v2 e
     JOIN students_v2 s ON s.id = e.student_id
     JOIN sections_v2 se ON se.id = e.section_id
     LEFT JOIN faculty_v2 f ON f.id = s.mentor_faculty_id
     LEFT JOIN team_members_v2 tm ON tm.enrollment_id = e.id AND tm.pbl_cycle_id = $1
     WHERE e.academic_cycle_id = $2
       AND e.program_id = $3
       AND e.semester = $4
       AND (tm.id IS NULL OR tm.team_id = $5)
     ORDER BY se.code, s.usn`,
    [teamRow.pbl_cycle_id, teamRow.academic_cycle_id, teamRow.program_id, teamRow.semester, teamId]
  );

  // Load faculty list for guide assignment
  const facultyList = await query<FacultyGuide>(
    `SELECT f.id, f.employee_id, f.name, f.designation, f.department,
            COALESCE(gl.overall_max_projects, 6)::int overall_max,
            COALESCE(sl.max_projects, 3)::int semester_max,
            (SELECT COUNT(*)::int FROM project_allocations_v2 pa JOIN projects_v2 p ON p.id = pa.project_id WHERE pa.guide_faculty_id = f.id AND p.pbl_cycle_id = $1 AND pa.status = 'ACTIVE') semester_load,
            (SELECT COUNT(*)::int FROM project_allocations_v2 pa JOIN projects_v2 p ON p.id = pa.project_id JOIN pbl_cycles_v2 pc ON pc.id = p.pbl_cycle_id WHERE pa.guide_faculty_id = f.id AND pc.academic_cycle_id = $2 AND pa.status = 'ACTIVE') total_load
     FROM faculty_v2 f
     LEFT JOIN faculty_guide_limits_v2 gl ON gl.faculty_id = f.id AND gl.academic_cycle_id = $2
     LEFT JOIN faculty_semester_guide_limits_v2 sl ON sl.faculty_id = f.id AND sl.pbl_cycle_id = $1
     WHERE f.is_active = true
     ORDER BY f.name`,
    [teamRow.pbl_cycle_id, teamRow.academic_cycle_id]
  );

  const teamData = {
    id: Number(teamRow.id),
    team_code: String(teamRow.team_code),
    team_name: String(teamRow.team_name),
    leader_enrollment_id: Number(teamRow.leader_enrollment_id),
    pbl_cycle_id: Number(teamRow.pbl_cycle_id),
    min_size: Number(teamRow.team_min_size) || 3,
    max_size: Number(teamRow.team_max_size) || 6,
    program_code: String(teamRow.program_code),
    cycle_name: String(teamRow.cycle_name),
    semester: Number(teamRow.semester),
    guide_faculty_id: teamRow.guide_faculty_id ? Number(teamRow.guide_faculty_id) : null,
    project_title: teamRow.project_title ? String(teamRow.project_title) : '',
  };

  return (
    <section className="section">
      <div className="container">
        <h1>Edit Team: {teamData.team_name}</h1>
        <p className="lead">
          Modify the team name, assign or change the team leader, add/remove members, and assign or change the project guide.
        </p>
        <EditTeamForm
          team={teamData}
          initialMembers={memberRows}
          availableStudents={availableStudents}
          facultyList={facultyList}
        />
      </div>
    </section>
  );
}
