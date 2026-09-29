import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';
import { normalizeExtensions, DANGEROUS_EXTENSIONS } from '@/lib/review-submissions';
import { submissionDateBounds } from '@/lib/review-dates';

export async function POST(req:Request){
  const u=await requireAnyRole(['PBL_COORDINATOR','HOD']);
  if(!u)return NextResponse.redirect(new URL('/login',req.url),303);
  const f=await req.formData();
  const cycleId=Number(f.get('pblCycleId'));
  const data=JSON.parse(String(f.get('rubricJson')||'{}'));
  const reqData=JSON.parse(String(f.get('requirementsJson')||'{}'));
  const items=Array.isArray(data.items)?data.items:[];
  const requirements=Array.isArray(reqData.requirements)?reqData.requirements:[];
  if(!items.length)return new NextResponse('At least one criterion is required',{status:400});

  let dates;
  try{
    dates=submissionDateBounds(String(f.get('submissionStartDate')||''),String(f.get('submissionLastDate')||''));
  }catch(e){
    return new NextResponse(e instanceof Error?e.message:'Invalid submission dates',{status:400});
  }

  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const pc=(await c.query('SELECT * FROM pbl_cycles_v2 WHERE id=$1',[cycleId])).rows[0];
    if(!pc)throw new Error('Invalid PBL cycle');
    if(!u.roles.includes('HOD')){
      const ok=(await c.query('SELECT 1 FROM pbl_coordinator_assignments_v2 WHERE id=$1 AND faculty_id=$2 AND is_active',[pc.coordinator_assignment_id,u.facultyId])).rowCount;
      if(!ok)throw new Error('Not coordinator for this semester');
    }

    const total=items.reduce((s:number,x:any)=>s+Number(x.maxMarks||0),0);
    const seq=(await c.query('SELECT COUNT(*)::int+1 n FROM pbl_reviews_v2 WHERE pbl_cycle_id=$1',[cycleId])).rows[0].n;
    const rv=(await c.query(`INSERT INTO pbl_reviews_v2(
      pbl_cycle_id,name,sequence_no,subject_code,review_date,submission_open_at,submission_deadline,maximum_marks,status,created_by
    ) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,'DRAFT',$8) RETURNING id`,[
      cycleId,String(f.get('reviewName')),seq,String(f.get('subjectCode')||''),dates.openAt,dates.deadline,total,u.id
    ])).rows[0];

    const rub=(await c.query(`INSERT INTO rubrics_v2(review_id,title,total_marks,status,created_by) VALUES($1,$2,$3,'DRAFT',$4) RETURNING id`,[
      rv.id,String(f.get('title')),total,u.id
    ])).rows[0];

    for(let i=0;i<items.length;i++){
      const it=items[i];
      const ri=(await c.query(`INSERT INTO rubric_items_v2(rubric_id,co_code,criterion_name,max_marks,display_order) VALUES($1,$2,$3,$4,$5) RETURNING id`,[
        rub.id,it.co||null,it.name,Number(it.maxMarks),i+1
      ])).rows[0];
      for(let j=0;j<(it.levels||[]).length;j++){
        const l=it.levels[j];
        await c.query(`INSERT INTO rubric_levels_v2(rubric_item_id,level_label,marks,descriptor,display_order) VALUES($1,$2,$3,$4,$5)`,[
          ri.id,l.label,Number(l.marks),l.descriptor,j+1
        ]);
      }
    }

    for(let i=0;i<requirements.length;i++){
      const r=requirements[i];
      const type=String(r.type||'OTHER').toUpperCase();
      if(!['PDF','PPT','DOC','ZIP','IMAGE','CSV','EXCEL','URL','SOURCE_CODE','OTHER'].includes(type))throw new Error('Unsupported requirement type');
      const exts=normalizeExtensions(r.extensions);
      if(exts.some(x=>DANGEROUS_EXTENSIONS.has(x)))throw new Error('Dangerous executable extensions cannot be configured');
      const maxSize=Math.round(Math.max(.1,Math.min(1,Number(r.maxSizeMB||1)))*1024*1024);
      const maxFiles=Math.max(1,Math.min(10,Number(r.maxFiles||1)));
      await c.query(`INSERT INTO review_file_requirements_v4(
        review_id,requirement_type,title,description,is_required,max_size_bytes,allowed_extensions,max_files,instructions,url_kind,custom_type,display_order
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[
        rv.id,type,String(r.title||`Requirement ${i+1}`),String(r.description||''),!!r.required,maxSize,exts,maxFiles,
        String(r.instructions||''),type==='URL'?(r.urlKind==='YOUTUBE'?'YOUTUBE':'ANY'):null,
        type==='OTHER'?String(r.customType||'Other'):null,i+1
      ]);
    }

    const action=String(f.get('action')||'SAVE_DRAFT');
    if(action==='PUBLISH'){
      await c.query(`UPDATE pbl_reviews_v2 SET status='PUBLISHED' WHERE id=$1`,[rv.id]);
      await c.query(`UPDATE rubrics_v2 SET status='PUBLISHED',published_at=NOW() WHERE id=$1`,[rub.id]);
    }
    await c.query('COMMIT');
    return NextResponse.redirect(new URL('/coordinator/rubrics',req.url),303);
  }catch(e){
    await c.query('ROLLBACK');
    return new NextResponse(e instanceof Error?e.message:'Unable to save rubric',{status:400});
  }finally{c.release();}
}
