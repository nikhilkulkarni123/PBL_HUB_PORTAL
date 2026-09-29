import Link from 'next/link';
import {requireAnyRole} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {query} from '@/lib/db';
import {dateOnlyLabel} from '@/lib/review-dates';

export default async function ReviewSubmissions(){
  const u=await requireAnyRole(['STUDENT']);
  if(!u?.studentId)redirect('/login');
  const rows=await query<any>(`SELECT rv.id review_id,rv.name review_name,rv.submission_open_at,rv.submission_deadline,t.id team_id,t.team_code,t.team_name,
    COALESCE(s.status,'DRAFT') submission_status,
    (SELECT COUNT(*) FROM review_file_requirements_v4 rfr WHERE rfr.review_id=rv.id) requirement_count,
    (SELECT string_agg(rfr.title, ', ' ORDER BY rfr.display_order) FROM review_file_requirements_v4 rfr WHERE rfr.review_id=rv.id) required_files,
    ev.status evaluation_status
    FROM student_enrollments_v2 e
    JOIN team_members_v2 tm ON tm.enrollment_id=e.id AND tm.status='ACTIVE'
    JOIN teams_v2 t ON t.id=tm.team_id
    JOIN pbl_reviews_v2 rv ON rv.pbl_cycle_id=t.pbl_cycle_id AND rv.status='PUBLISHED'
    LEFT JOIN team_review_submissions_v4 s ON s.review_id=rv.id AND s.team_id=t.id
    LEFT JOIN review_evaluations_v3 ev ON ev.review_id=rv.id AND ev.team_id=t.id
    WHERE e.student_id=$1 ORDER BY rv.sequence_no`,[u.studentId]);
  return <section className="section"><div className="container">
    <h1>Review Submissions</h1>
    <p className="lead">One team submission is shared by all members. Any team member can complete the required submission between the Submission Start Date and Submission Last Date.</p>
    <div className="grid">{rows.length?rows.map((r:any)=><div className="card" key={r.review_id}>
      <h2>{r.review_name}</h2>
      <p><b>Team:</b> {r.team_code} — {r.team_name}</p>
      <p><b>Submission Start Date:</b> {r.submission_open_at?dateOnlyLabel(r.submission_open_at):'Immediately'}</p>
      <p><b>Submission Last Date:</b> {r.submission_deadline?dateOnlyLabel(r.submission_deadline):'Not specified'}</p>
      <p><b>Required fields:</b> {r.requirement_count}</p>
      <p><b>Required files/links:</b> {r.required_files||'None'}</p>
      <p><b>Submission:</b> {r.submission_status==='SUBMITTED'?'Submitted':'Not Submitted'}</p>
      <p><b>Evaluation:</b> {r.evaluation_status||'Not evaluated'}</p>
      <Link className="btn secondary" href={`/student/review-submissions/${r.review_id}`}>{r.submission_status==='SUBMITTED'?'View Submission':'Open Submission'}</Link>
      {r.evaluation_status==='VERIFIED'&&<> <Link className="btn" href={`/student/reviews/${r.review_id}/rubric-sheet`}>Download Rubric Sheet</Link></>}
    </div>):<div className="notice">No published reviews are available for your team.</div>}</div>
  </div></section>;
}
