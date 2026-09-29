import {requireAnyRole} from '@/lib/auth';
import {query} from '@/lib/db';
import {redirect,notFound} from 'next/navigation';
import {humanBytes} from '@/lib/review-submissions';
import {dateOnlyLabel} from '@/lib/review-dates';

export default async function Submission({params,searchParams}:{params:Promise<{reviewId:string}>;searchParams:Promise<{error?:string}>}){
  const u=await requireAnyRole(['STUDENT']);
  if(!u?.studentId)redirect('/login');
  const {reviewId}=await params;
  const {error}=await searchParams;
  const rid=Number(reviewId);
  const ctx=(await query<any>(`SELECT rv.id,rv.name,rv.submission_open_at,rv.submission_deadline,t.id team_id,t.team_code,t.team_name,
    COALESCE(s.status,'DRAFT') submission_status,s.id submission_id,s.submitted_at
    FROM pbl_reviews_v2 rv
    JOIN teams_v2 t ON t.pbl_cycle_id=rv.pbl_cycle_id
    JOIN team_members_v2 tm ON tm.team_id=t.id AND tm.status='ACTIVE'
    JOIN student_enrollments_v2 e ON e.id=tm.enrollment_id
    LEFT JOIN team_review_submissions_v4 s ON s.review_id=rv.id AND s.team_id=t.id
    WHERE rv.id=$1 AND rv.status='PUBLISHED' AND e.student_id=$2 LIMIT 1`,[rid,u.studentId]))[0];
  if(!ctx)notFound();
  const reqs=await query<any>(`SELECT * FROM review_file_requirements_v4 WHERE review_id=$1 ORDER BY display_order`,[rid]);
  const items=ctx.submission_id?await query<any>(`SELECT i.id,i.requirement_id,i.original_filename,i.size_bytes,i.url_value FROM team_review_submission_items_v4 i WHERE i.submission_id=$1 ORDER BY i.requirement_id,i.created_at`,[ctx.submission_id]):[];
  const grouped:Record<string,any[]>={};
  items.forEach((i:any)=>(grouped[String(i.requirement_id)]??=[]).push(i));
  const notOpen=ctx.submission_open_at&&new Date(ctx.submission_open_at).getTime()>Date.now();
  const deadlinePassed=ctx.submission_deadline&&new Date(ctx.submission_deadline).getTime()<Date.now();
  const locked=ctx.submission_status==='SUBMITTED'||notOpen||deadlinePassed;

  return <section className="section"><div className="container">
    <h1>{ctx.name} — Team Submission</h1>
    <p><b>{ctx.team_code} — {ctx.team_name}</b></p>
    <p><b>Status:</b> {ctx.submission_status==='SUBMITTED'?'Submitted':'Not Submitted'} {ctx.submitted_at?`on ${new Date(ctx.submitted_at).toLocaleString('en-IN')}`:''}</p>
    <p><b>Submission Start Date:</b> {ctx.submission_open_at?dateOnlyLabel(ctx.submission_open_at):'Immediately'}</p>
    <p><b>Submission Last Date:</b> {ctx.submission_deadline?dateOnlyLabel(ctx.submission_deadline):'Not specified'}</p>
    {error&&<div className="notice error"><b>Submission could not be completed:</b> {error}</div>}
    {notOpen&&ctx.submission_status!=='SUBMITTED'&&<div className="notice">Submission has not opened yet.</div>}
    {deadlinePassed&&ctx.submission_status!=='SUBMITTED'&&<div className="notice error">Submission last date has passed.</div>}
    {!reqs.length&&<div className="notice">This review has no configured submission files. No upload is required.</div>}

    <form action={`/api/student/review-submissions/${rid}/submit`} method="post" encType="multipart/form-data">
      {reqs.map((r:any)=><div className="card" key={r.id}>
        <h2>{r.title} {r.is_required&&<span className="tag">Required</span>}</h2>
        <p>{r.description||''}</p>
        <p className="muted"><b>Type:</b> {r.requirement_type}{r.url_kind==='YOUTUBE'?' — YouTube link':''} · <b>Allowed:</b> {r.requirement_type==='URL'?(r.url_kind==='YOUTUBE'?'YouTube URL':'HTTP/HTTPS web link'):(r.allowed_extensions?.length?r.allowed_extensions.map((x:string)=>'.'+x).join(', '):'configured type')} · <b>Max:</b> {r.requirement_type==='URL'?'1 link':`${r.max_files} file(s), ${humanBytes(Number(r.max_size_bytes))} each`}</p>
        {r.instructions&&<div className="notice">{r.instructions}</div>}
        {(grouped[String(r.id)]||[]).length>0&&<div><b>Current submission:</b>{grouped[String(r.id)].map((i:any)=><p key={i.id}>{i.url_value?<a href={i.url_value} target="_blank" rel="noreferrer">{i.url_value}</a>:<a href={`/api/review-submission-files/${i.id}`}>{i.original_filename} ({humanBytes(Number(i.size_bytes||0))})</a>}</p>)}</div>}
        {!locked&&(r.requirement_type==='URL'?<div className="field"><label>{r.title}</label><input name={`url_${r.id}`} type="url" placeholder={r.url_kind==='YOUTUBE'?'https://youtu.be/...':'https://drive.google.com/... or https://...'}/></div>:<div className="field"><label>Upload {r.title}</label><input name={`file_${r.id}`} type="file" multiple={Number(r.max_files)>1} accept={(r.allowed_extensions||[]).map((x:string)=>'.'+x).join(',')||undefined}/></div>)}
      </div>)}
      {!locked&&<><button className="btn secondary" name="action" value="SAVE_DRAFT">Save Draft</button> <button className="btn" name="action" value="SUBMIT">Submit Team Review</button></>}
    </form>
  </div></section>;
}
