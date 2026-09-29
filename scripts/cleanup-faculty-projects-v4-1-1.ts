import {pool} from '../lib/db';

async function main(){
  if(process.env.CONFIRM_FACULTY_PROJECT_CLEANUP!=='YES'){
    throw new Error('Refusing cleanup. Set CONFIRM_FACULTY_PROJECT_CLEANUP=YES after confirming that faculty-published projects/applications/allocations should be removed.');
  }

  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const projects=(await c.query(`SELECT id,project_code,title FROM projects_v2 WHERE project_type='FACULTY_PROJECT' FOR UPDATE`)).rows;
    const projectIds=projects.map((p:any)=>Number(p.id));
    if(!projectIds.length){
      await c.query('COMMIT');
      console.log('No faculty-published projects were found. No student, faculty, team, or password data were changed.');
      return;
    }

    const teamRows=(await c.query(`SELECT DISTINCT team_id FROM project_allocations_v2 WHERE project_id=ANY($1::bigint[])`,[projectIds])).rows;
    const teamIds=teamRows.map((r:any)=>Number(r.team_id));

    const apps=await c.query(`DELETE FROM project_applications_v2 WHERE project_id=ANY($1::bigint[])`,[projectIds]);
    const guideRequests=await c.query(`DELETE FROM guide_requests_v2 WHERE project_id=ANY($1::bigint[])`,[projectIds]);
    const allocations=await c.query(`DELETE FROM project_allocations_v2 WHERE project_id=ANY($1::bigint[])`,[projectIds]);
    const deletedProjects=await c.query(`DELETE FROM projects_v2 WHERE id=ANY($1::bigint[])`,[projectIds]);

    let reactivated=0;
    if(teamIds.length){
      // Run this cleanup before the V4.1.1 team-size migration on an existing database.
      // That allows an older valid team to be unallocated without changing its membership.
      const r=await c.query(`UPDATE teams_v2 t
        SET status='ACTIVE',locked_at=NULL
        WHERE t.id=ANY($1::bigint[])
          AND t.status IN ('PROJECT_ASSIGNED','LOCKED')
          AND NOT EXISTS(SELECT 1 FROM project_allocations_v2 pa WHERE pa.team_id=t.id AND pa.status='ACTIVE')`,[teamIds]);
      reactivated=r.rowCount||0;
    }

    await c.query('COMMIT');
    console.log(`Faculty project cleanup complete: ${deletedProjects.rowCount||0} project(s), ${apps.rowCount||0} application(s), ${allocations.rowCount||0} allocation(s), ${guideRequests.rowCount||0} guide-request row(s) removed; ${reactivated} allocated team(s) returned to ACTIVE.`);
    console.log('Student master, student logins/password hashes, faculty master, faculty logins, team membership, student-created projects and review data were not deleted.');
  }catch(e){
    await c.query('ROLLBACK');
    throw e;
  }finally{
    c.release();
    await pool.end();
  }
}

main().catch(e=>{console.error(e);process.exit(1)});
