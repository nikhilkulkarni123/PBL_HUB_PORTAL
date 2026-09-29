import {NextResponse} from 'next/server';
import {requireAnyRole} from '@/lib/auth';
import {query} from '@/lib/db';

function backWithError(req:Request,message:string){
  return NextResponse.redirect(new URL(`/faculty/projects/new?error=${encodeURIComponent(message)}`,req.url),303);
}

export async function POST(req:Request){
  const u=await requireAnyRole(['FACULTY']);
  if(!u||!u.facultyId)return NextResponse.redirect(new URL('/login',req.url),303);
  try{
    const f=await req.formData();
    const pblCycleId=Number(f.get('pblCycleId'));
    const title=String(f.get('title')||'').trim();
    const shortDescription=String(f.get('shortDescription')||'').trim();
    const description=String(f.get('description')||'').trim();
    const problemStatement=String(f.get('problemStatement')||'').trim();
    const expectedOutcome=String(f.get('expectedOutcome')||'').trim();
    const domain=String(f.get('domain')||'').trim();
    const technologyStack=String(f.get('technologyStack')||'').trim();
    const maxTeams=Number(f.get('maxTeams')||1);

    if(!Number.isInteger(pblCycleId)||pblCycleId<=0)return backWithError(req,'Select a valid PBL semester.');
    if(!title)return backWithError(req,'Project title is required.');
    if(title.length>260)return backWithError(req,'Project title must be 260 characters or fewer.');
    if(!shortDescription)return backWithError(req,'Short description is required.');
    if(!description)return backWithError(req,'Detailed write-up is required.');
    if(domain.length>120)return backWithError(req,'Domain must be 120 characters or fewer.');
    if(!Number.isInteger(maxTeams)||maxTeams<1)return backWithError(req,'Maximum teams must be at least 1.');

    const cycle=(await query<{id:number}>('SELECT id FROM pbl_cycles_v2 WHERE id=$1',[pblCycleId]))[0];
    if(!cycle)return backWithError(req,'Selected PBL semester was not found.');

    const n=(await query<{n:number}>('SELECT COUNT(*)::int+1 n FROM projects_v2 WHERE pbl_cycle_id=$1',[pblCycleId]))[0]?.n||1;
    const code=`PBL-P-${pblCycleId}-${String(n).padStart(4,'0')}`;
    await query(`INSERT INTO projects_v2(
      pbl_cycle_id,project_code,title,short_description,description,problem_statement,expected_outcome,domain,technology_stack,
      project_type,owner_faculty_id,guide_faculty_id,max_teams,application_mode,status,published_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'FACULTY_PROJECT',$10,$10,$11,'OPEN','PUBLISHED',NOW())`,[
      pblCycleId,code,title,shortDescription,description,problemStatement,expectedOutcome,domain,technologyStack,u.facultyId,maxTeams
    ]);
    return NextResponse.redirect(new URL('/projects',req.url),303);
  }catch(e){
    const message=e instanceof Error?e.message:'Unable to publish project.';
    return backWithError(req,`Unable to publish project: ${message}`);
  }
}
