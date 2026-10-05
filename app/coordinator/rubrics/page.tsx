import { requireAnyRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import RubricDesigner from '@/components/rubric/RubricDesigner';
import Link from 'next/link';
import { dateOnlyLabel } from '@/lib/review-dates';

export default async function Rubrics(){
  const u=await requireAnyRole(['PBL_COORDINATOR','HOD']);
  if(!u)redirect('/login');
  const cycles=await query<any>(`SELECT pc.id,pc.semester,ac.name,pr.code as program_code,pr.name as program_name
    FROM pbl_cycles_v2 pc
    JOIN academic_cycles_v2 ac ON ac.id=pc.academic_cycle_id
    JOIN programs_v2 pr ON pr.id=pc.program_id
    LEFT JOIN pbl_coordinator_assignments_v2 ca ON ca.id=pc.coordinator_assignment_id
    WHERE $1::boolean OR ca.faculty_id=$2
    ORDER BY pr.code,pc.semester`,[u.roles.includes('HOD'),u.facultyId||null]);
  const ids=cycles.map(c=>c.id);
  const existing=ids.length?await query<any>(`SELECT rv.id,rv.name,rv.maximum_marks,rv.status,rv.submission_open_at,rv.submission_deadline,pc.semester,r.title,pr.code as program_code,
      (SELECT COUNT(*) FROM review_file_requirements_v4 rfr WHERE rfr.review_id=rv.id)::int requirement_count
    FROM pbl_reviews_v2 rv
    JOIN pbl_cycles_v2 pc ON pc.id=rv.pbl_cycle_id
    JOIN programs_v2 pr ON pr.id=pc.program_id
    LEFT JOIN rubrics_v2 r ON r.review_id=rv.id
    WHERE rv.pbl_cycle_id=ANY($1::int[])
    ORDER BY pr.code,pc.semester,rv.sequence_no`,[ids]):[];

  return <section className="section"><div className="container">
    <RubricDesigner cycles={cycles}/>
    <h2>Existing Reviews</h2>
    <div className="tablewrap"><table><thead><tr>
      <th>Institution</th><th>Semester</th><th>Review</th><th>Rubric</th><th>Marks</th><th>Submission Files</th><th>Start Date</th><th>Last Date</th><th>Status</th><th>Action</th>
    </tr></thead><tbody>{existing.map((x:any)=><tr key={x.id}>
      <td><span style={{fontSize:'12px',fontWeight:'800',padding:'3px 8px',borderRadius:'4px',backgroundColor:x.program_code==='GMIT-CSE'?'#fef3c7':'#e0f2fe',color:x.program_code==='GMIT-CSE'?'#92400e':'#0369a1'}}>{x.program_code==='GMIT-CSE'?'GMIT':'GMU'}</span></td><td>{x.semester}</td><td>{x.name}</td><td>{x.title||'—'}</td><td>{x.maximum_marks}</td><td>{x.requirement_count}</td>
      <td>{dateOnlyLabel(x.submission_open_at)}</td><td>{dateOnlyLabel(x.submission_deadline)}</td><td>{x.status}</td>
      <td>{x.status!=='PUBLISHED'&&<><Link className="btn secondary" href={`/coordinator/reviews/${x.id}/requirements`}>Edit Requirements</Link>{' '}<form style={{display:'inline'}} action={`/api/coordinator/reviews/${x.id}/publish`} method="post"><button className="btn">Publish</button></form></>}{x.status==='PUBLISHED'&&<span className="status">Locked</span>}</td>
    </tr>)}</tbody></table></div>
  </div></section>;
}
