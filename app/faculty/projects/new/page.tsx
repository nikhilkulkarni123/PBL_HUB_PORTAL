import {requireAnyRole} from '@/lib/auth';
import {query} from '@/lib/db';
import {redirect} from 'next/navigation';

export default async function NewProject({searchParams}:{searchParams:Promise<{error?:string}>}){
  const u=await requireAnyRole(['FACULTY']);
  if(!u)redirect('/login');
  const {error}=await searchParams;
  const cycles=await query<{id:number;semester:number;name:string}>(`SELECT pc.id,pc.semester,ac.name FROM pbl_cycles_v2 pc JOIN academic_cycles_v2 ac ON ac.id=pc.academic_cycle_id ORDER BY pc.semester`);
  return <section className="section"><div className="container"><div className="form">
    <h1>Publish Faculty Project</h1>
    <p>You will be recorded as both <b>Project Owner</b> and <b>Project Guide</b>. Eligible teams in the selected semester may apply.</p>
    {error&&<div className="notice error">{error}</div>}
    <form action="/api/projects" method="post">
      <div className="field"><label>PBL semester</label><select name="pblCycleId" required>{cycles.map(c=><option value={c.id} key={c.id}>{c.name} — Semester {c.semester}</option>)}</select></div>
      <div className="field"><label>Project title</label><input name="title" required maxLength={260}/></div>
      <div className="field"><label>Short description</label><textarea name="shortDescription" required rows={6}/></div>
      <div className="field"><label>Detailed write-up</label><textarea name="description" required rows={10}/></div>
      <div className="field"><label>Problem statement</label><textarea name="problemStatement" rows={10}/></div>
      <div className="field"><label>Expected outcome</label><textarea name="expectedOutcome" rows={7}/></div>
      <div className="field"><label>Domain</label><input name="domain" maxLength={120}/></div>
      <div className="field"><label>Technology stack</label><textarea name="technologyStack" rows={4}/></div>
      <div className="field"><label>Maximum teams for this idea</label><input name="maxTeams" type="number" min="1" defaultValue="1"/></div>
      <button className="btn">Publish Project</button>
    </form>
  </div></div></section>;
}
