import { requireAnyRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';

type ApplicationRow={
  id:number; title:string; team_code:string; team_name:string; statement_of_interest:string;
  proposed_approach:string; status:string; members:any[];
};

export default async function ApplicationsReceived(){
  const u=await requireAnyRole(['FACULTY']);
  if(!u?.facultyId) redirect('/login');
  const rows=await query<ApplicationRow>(`
    SELECT pa.id,p.title,t.team_code,t.team_name,pa.statement_of_interest,pa.proposed_approach,pa.status,
      COALESCE(jsonb_agg(jsonb_build_object(
        'name',s.name,'usn',s.usn,'email',COALESCE(s.email,''),'department',COALESCE(pr.department,pr.name,''),
        'semester',e.semester,'section',se.code,'role',tm.member_role
      ) ORDER BY CASE WHEN tm.member_role='LEADER' THEN 0 ELSE 1 END,s.usn)
      FILTER (WHERE s.id IS NOT NULL),'[]'::jsonb) members
    FROM project_applications_v2 pa
    JOIN projects_v2 p ON p.id=pa.project_id
    JOIN teams_v2 t ON t.id=pa.team_id
    LEFT JOIN team_members_v2 tm ON tm.team_id=t.id AND tm.status='ACTIVE'
    LEFT JOIN student_enrollments_v2 e ON e.id=tm.enrollment_id
    LEFT JOIN students_v2 s ON s.id=e.student_id
    LEFT JOIN programs_v2 pr ON pr.id=e.program_id
    LEFT JOIN sections_v2 se ON se.id=e.section_id
    WHERE p.owner_faculty_id=$1
    GROUP BY pa.id,p.title,t.team_code,t.team_name,pa.statement_of_interest,pa.proposed_approach,pa.status,pa.applied_at
    ORDER BY pa.applied_at DESC`,[u.facultyId]);
  return <section className="section"><div className="container"><h1>Applications Received</h1>
    {rows.length===0&&<p>No applications yet.</p>}
    {rows.map(a=><article className="card" key={a.id}>
      <span className="status">{a.status}</span><h2>{a.title}</h2>
      <p><b>Team:</b> {a.team_code} — {a.team_name}</p>
      <p><b>Interest:</b> {a.statement_of_interest||'—'}</p><p><b>Approach:</b> {a.proposed_approach||'—'}</p>
      <h3>Team Members</h3>
      {a.members.length===0?<p className="muted">No team members found.</p>:
      <div className="tablewrap"><table><thead><tr><th>Name</th><th>USN / Student ID</th><th>Email</th><th>Department</th><th>Semester</th><th>Section</th><th>Role</th></tr></thead>
      <tbody>{a.members.map((m:any)=><tr key={m.usn}><td>{m.name}</td><td>{m.usn}</td><td>{m.email||'—'}</td><td>{m.department||'—'}</td><td>{m.semester||'—'}</td><td>{m.section||'—'}</td><td>{m.role}</td></tr>)}</tbody></table></div>}
      {['SUBMITTED','UNDER_REVIEW','DISCUSSION'].includes(a.status)&&<form action={`/api/applications/${a.id}/decision`} method="post"><div className="field"><label>Remarks (mandatory for rejection)</label><textarea name="remarks"/></div><button className="btn" name="decision" value="ACCEPTED">Accept Team</button> <button className="btn danger" name="decision" value="REJECTED">Reject</button></form>}
    </article>)}
  </div></section>
}
