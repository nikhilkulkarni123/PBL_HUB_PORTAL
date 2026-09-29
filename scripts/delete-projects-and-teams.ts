import { pool } from '../lib/db';

async function main() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    // Check FKs referencing teams_v2 or projects_v2
    const fkQuery = `
      SELECT
        tc.table_schema, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name IN ('teams_v2', 'projects_v2')
    `;
    const fks = await c.query(fkQuery);
    console.log('FK references to teams_v2 & projects_v2:', fks.rows);

    const countsBefore = {
      projects_v2: (await c.query('SELECT count(*) FROM projects_v2')).rows[0].count,
      teams_v2: (await c.query('SELECT count(*) FROM teams_v2')).rows[0].count,
      team_members_v2: (await c.query('SELECT count(*) FROM team_members_v2')).rows[0].count,
      project_allocations_v2: (await c.query('SELECT count(*) FROM project_allocations_v2')).rows[0].count,
      project_applications_v2: (await c.query('SELECT count(*) FROM project_applications_v2')).rows[0].count,
      guide_requests_v2: (await c.query('SELECT count(*) FROM guide_requests_v2')).rows[0].count,
    };
    console.log('Counts before deletion:', countsBefore);

    // 1. Delete review deliverables / submissions related to teams
    await c.query('DELETE FROM team_review_submission_items_v4');
    await c.query('DELETE FROM team_review_submissions_v4');

    // 2. Delete rubric logs, verification actions, contributions, rubric scores, evaluations, review scores
    await c.query('DELETE FROM rubric_pdf_access_log_v4');
    await c.query('DELETE FROM review_verification_actions_v3');
    await c.query('DELETE FROM student_contributions_v3');
    await c.query('DELETE FROM team_rubric_scores_v3');
    await c.query('DELETE FROM review_evaluations_v3');
    await c.query('DELETE FROM review_scores_v2');

    // 3. Delete allocations, applications, guide requests
    const delAlloc = await c.query('DELETE FROM project_allocations_v2');
    const delApps = await c.query('DELETE FROM project_applications_v2');
    const delGuideReq = await c.query('DELETE FROM guide_requests_v2');

    // 4. Delete projects
    // Note: projects_v2 may have owner_team_id referencing teams_v2
    const delProj = await c.query('DELETE FROM projects_v2');

    // 5. Delete team members and teams
    const delMembers = await c.query('DELETE FROM team_members_v2');
    const delTeams = await c.query('DELETE FROM teams_v2');

    await c.query('COMMIT');

    console.log('Successfully deleted:');
    console.log('- Projects deleted:', delProj.rowCount);
    console.log('- Allocations deleted:', delAlloc.rowCount);
    console.log('- Applications deleted:', delApps.rowCount);
    console.log('- Guide requests deleted:', delGuideReq.rowCount);
    console.log('- Teams deleted:', delTeams.rowCount);
    console.log('- Team members deleted:', delMembers.rowCount);

    const countsAfter = {
      projects_v2: (await c.query('SELECT count(*) FROM projects_v2')).rows[0].count,
      teams_v2: (await c.query('SELECT count(*) FROM teams_v2')).rows[0].count,
      team_members_v2: (await c.query('SELECT count(*) FROM team_members_v2')).rows[0].count,
      students_v2: (await c.query('SELECT count(*) FROM students_v2')).rows[0].count,
      faculty_v2: (await c.query('SELECT count(*) FROM faculty_v2')).rows[0].count,
    };
    console.log('Counts after deletion:', countsAfter);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('Error during deletion:', e);
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
