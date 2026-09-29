import Link from 'next/link';
import { requireAnyRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import { dateOnlyLabel } from '@/lib/review-dates';

export default async function MyTeam(){
  const u=await requireAnyRole(['STUDENT']); if(!u?.studentId) redirect('/login');
  const team=(await query<any>(`
    SELECT t.id,t.team_code,t.team_name,t.status,pc.semester,se.code section,
      cf.name coordinator_name,p.title project_title,p.problem_statement,p.domain,p.status project_status,g.name guide_name
    FROM team_members_v2 tm
    JOIN student_enrollments_v2 e ON e.id=tm.enrollment_id
    JOIN teams_v2 t ON t.id=tm.team_id
    JOIN pbl_cycles_v2 pc ON pc.id=t.pbl_cycle_id
    JOIN sections_v2 se ON se.id=e.section_id
    LEFT JOIN pbl_coordinator_assignments_v2 ca ON ca.id=pc.coordinator_assignment_id
    LEFT JOIN faculty_v2 cf ON cf.id=ca.faculty_id
    LEFT JOIN project_allocations_v2 pa ON pa.team_id=t.id AND pa.status='ACTIVE'
    LEFT JOIN projects_v2 p ON p.id=pa.project_id
    LEFT JOIN faculty_v2 g ON g.id=pa.guide_faculty_id
    WHERE e.student_id=$1 AND tm.status='ACTIVE'
    ORDER BY e.id DESC LIMIT 1`,[u.studentId]))[0];
  if(!team) return <section className="section"><div className="container"><h1>My Team</h1><p>You are not currently assigned to an active PBL team.</p></div></section>;
  const members=await query<any>(`SELECT s.name,s.usn,COALESCE(s.email,'') email,pr.department,e.semester,se.code section,tm.member_role FROM team_members_v2 tm JOIN student_enrollments_v2 e ON e.id=tm.enrollment_id JOIN students_v2 s ON s.id=e.student_id JOIN programs_v2 pr ON pr.id=e.program_id JOIN sections_v2 se ON se.id=e.section_id WHERE tm.team_id=$1 AND tm.status='ACTIVE' ORDER BY CASE WHEN tm.member_role='LEADER' THEN 0 ELSE 1 END,s.usn`,[team.id]);
  const reviews=await query<any>(`SELECT rv.id,rv.name,rv.submission_deadline,rv.maximum_marks,COALESCE(ev.status,'NOT_EVALUATED') evaluation_status FROM pbl_reviews_v2 rv JOIN teams_v2 t ON t.pbl_cycle_id=rv.pbl_cycle_id LEFT JOIN review_evaluations_v3 ev ON ev.review_id=rv.id AND ev.team_id=t.id WHERE t.id=$1 AND rv.status='PUBLISHED' ORDER BY rv.sequence_no`,[team.id]);
  return <section className="section"><div className="container"><h1>My Team</h1>
    <div className="card"><h2>{team.team_code} — {team.team_name}</h2><p><b>Semester:</b> {team.semester} &nbsp; <b>Section:</b> {team.section} &nbsp; <b>Status:</b> {team.status}</p><p><b>PBL Coordinator:</b> {team.coordinator_name||'—'}</p></div>
    <h2>Team Members</h2><div className="tablewrap"><table><thead><tr><th>Name</th><th>USN</th><th>Email</th><th>Department</th><th>Semester</th><th>Section</th><th>Role</th></tr></thead><tbody>{members.map((m:any)=><tr key={m.usn}><td>{m.name}</td><td>{m.usn}</td><td>{m.email||'—'}</td><td>{m.department||'—'}</td><td>{m.semester}</td><td>{m.section}</td><td>{m.member_role}</td></tr>)}</tbody></table></div>
    <h2>Project</h2>{team.project_title?<div className="card"><h3>{team.project_title}</h3><p><b>Problem Statement:</b> {team.problem_statement||'—'}</p><p><b>Domain:</b> {team.domain||'—'}</p><p><b>Faculty Guide:</b> {team.guide_name||'—'}</p><p><b>Project Status:</b> {team.project_status||'—'}</p></div>:<p>No project has been assigned yet.</p>}
    <h2>Reviews & Rubrics</h2><div className="tablewrap"><table><thead><tr><th>Review</th><th>Submission Last Date</th><th>Marks</th><th>Status</th><th>View</th></tr></thead><tbody>{reviews.length?reviews.map((r:any)=><tr key={r.id}><td>{r.name}</td><td>{r.submission_deadline?dateOnlyLabel(r.submission_deadline):'—'}</td><td>{r.maximum_marks}</td><td>{r.evaluation_status}</td><td><Link className="btn secondary" href={`/student/reviews/${r.id}`}>View Rubric</Link></td></tr>):<tr><td colSpan={5}>No published reviews yet.</td></tr>}</tbody></table></div>
  </div></section>
}
