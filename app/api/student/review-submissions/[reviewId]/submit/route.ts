import {NextResponse} from 'next/server';
import {requireAnyRole} from '@/lib/auth';
import {pool} from '@/lib/db';
import {fileExtension,isDangerousFilename,isValidUrl} from '@/lib/review-submissions';

export const runtime='nodejs';

export async function POST(req:Request,{params}:{params:Promise<{reviewId:string}>}){
  const u=await requireAnyRole(['STUDENT']);
  if(!u?.studentId)return NextResponse.redirect(new URL('/login',req.url),303);
  const {reviewId}=await params;
  const rid=Number(reviewId);
  if(!Number.isFinite(rid))return NextResponse.redirect(new URL('/student/review-submissions',req.url),303);

  const form=await req.formData();
  const action=String(form.get('action')||'SAVE_DRAFT');
  const isFinal=action==='SUBMIT';
  if(action!=='SUBMIT'&&action!=='SAVE_DRAFT')return NextResponse.redirect(new URL(`/student/review-submissions/${rid}?error=${encodeURIComponent('Invalid submission action.')}`,req.url),303);

  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const ctx=(await c.query(`SELECT rv.*,t.id team_id
      FROM pbl_reviews_v2 rv
      JOIN teams_v2 t ON t.pbl_cycle_id=rv.pbl_cycle_id
      JOIN team_members_v2 tm ON tm.team_id=t.id AND tm.status='ACTIVE'
      JOIN student_enrollments_v2 e ON e.id=tm.enrollment_id
      WHERE rv.id=$1 AND rv.status='PUBLISHED' AND e.student_id=$2
      LIMIT 1 FOR UPDATE OF rv`,[rid,u.studentId])).rows[0];
    if(!ctx)throw new Error('Review/team not found.');
    if(ctx.submission_open_at&&new Date(ctx.submission_open_at).getTime()>Date.now())throw new Error('Submission has not opened yet.');
    if(ctx.submission_deadline&&new Date(ctx.submission_deadline).getTime()<Date.now())throw new Error('Submission last date has passed.');

    let sub=(await c.query(`SELECT * FROM team_review_submissions_v4 WHERE review_id=$1 AND team_id=$2 FOR UPDATE`,[rid,ctx.team_id])).rows[0];
    if(sub?.status==='SUBMITTED')throw new Error('Team submission is already final.');
    if(!sub)sub=(await c.query(`INSERT INTO team_review_submissions_v4(review_id,team_id,submitted_by_user_id) VALUES($1,$2,$3) RETURNING *`,[rid,ctx.team_id,u.id])).rows[0];

    const reqs=(await c.query(`SELECT * FROM review_file_requirements_v4 WHERE review_id=$1 ORDER BY display_order`,[rid])).rows;
    for(const r of reqs){
      if(r.requirement_type==='URL'){
        const val=String(form.get(`url_${r.id}`)||'').trim();
        if(val){
          const youtubeOnly=r.url_kind==='YOUTUBE';
          if(!isValidUrl(val,youtubeOnly))throw new Error(`${r.title}: enter a valid ${youtubeOnly?'YouTube ':'web '}link.`);
          await c.query(`DELETE FROM team_review_submission_items_v4 WHERE submission_id=$1 AND requirement_id=$2`,[sub.id,r.id]);
          await c.query(`INSERT INTO team_review_submission_items_v4(submission_id,requirement_id,url_value,uploaded_by_user_id) VALUES($1,$2,$3,$4)`,[sub.id,r.id,val,u.id]);
        }
      }else{
        const vals=form.getAll(`file_${r.id}`).filter(x=>x instanceof File&&x.size>0) as File[];
        if(vals.length){
          if(vals.length>Number(r.max_files))throw new Error(`${r.title}: maximum ${r.max_files} file(s) allowed.`);
          for(const file of vals){
            if(file.size>Number(r.max_size_bytes))throw new Error(`${r.title}: ${file.name} exceeds the configured size limit.`);
            if(isDangerousFilename(file.name))throw new Error(`${r.title}: executable or dangerous file types are not allowed.`);
            const ext=fileExtension(file.name);
            const allowed=(r.allowed_extensions||[]).map((x:string)=>String(x).toLowerCase());
            if(allowed.length&&!allowed.includes(ext))throw new Error(`${r.title}: .${ext||'(none)'} is not an allowed extension.`);
          }
          await c.query(`DELETE FROM team_review_submission_items_v4 WHERE submission_id=$1 AND requirement_id=$2`,[sub.id,r.id]);
          for(const file of vals){
            const buf=Buffer.from(await file.arrayBuffer());
            await c.query(`INSERT INTO team_review_submission_items_v4(submission_id,requirement_id,original_filename,content_type,size_bytes,file_data,uploaded_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,[sub.id,r.id,file.name,file.type||'application/octet-stream',file.size,buf,u.id]);
          }
        }
      }
    }

    const counts=(await c.query(`SELECT r.id,r.title,r.is_required,r.max_files,COUNT(i.id)::int n
      FROM review_file_requirements_v4 r
      LEFT JOIN team_review_submission_items_v4 i ON i.requirement_id=r.id AND i.submission_id=$2
      WHERE r.review_id=$1
      GROUP BY r.id ORDER BY r.display_order`,[rid,sub.id])).rows;
    const missing=counts.filter((x:any)=>x.is_required&&Number(x.n)<1);
    if(isFinal&&missing.length)throw new Error(`Required submission missing: ${missing.map((x:any)=>x.title).join(', ')}.`);

    const status=isFinal?'SUBMITTED':'DRAFT';
    const validationPassed=isFinal&&missing.length===0;
    // Keep each PostgreSQL parameter in one consistent type. The old query reused $1
    // both as VARCHAR status and in a text comparison, causing "inconsistent types deduced".
    await c.query(`UPDATE team_review_submissions_v4
      SET status=$1::varchar(20),
          validation_passed=$2::boolean,
          submitted_by_user_id=$3::bigint,
          submitted_at=CASE WHEN $5::boolean THEN NOW() ELSE submitted_at END,
          updated_at=NOW()
      WHERE id=$4::bigint`,[status,validationPassed,u.id,sub.id,isFinal]);

    await c.query('COMMIT');
    return NextResponse.redirect(new URL('/student/review-submissions',req.url),303);
  }catch(e){
    await c.query('ROLLBACK');
    const message=e instanceof Error?e.message:'Submission failed.';
    return NextResponse.redirect(new URL(`/student/review-submissions/${rid}?error=${encodeURIComponent(message)}`,req.url),303);
  }finally{
    c.release();
  }
}
