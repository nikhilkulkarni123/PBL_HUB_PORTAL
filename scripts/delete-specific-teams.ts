const { Pool } = require('pg');

try {
  process.loadEnvFile();
} catch (e) {}

// Strip channel_binding if present to avoid driver handshake mismatch
let connStr = process.env.DATABASE_URL || '';
connStr = connStr.replace('&channel_binding=require', '').replace('channel_binding=require&', '').replace('?channel_binding=require', '');

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function getClientWithRetry(retries = 5, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`Connecting to Neon PostgreSQL (attempt ${i}/${retries})...`);
      const client = await pool.connect();
      console.log('Connected successfully!');
      return client;
    } catch (err: any) {
      console.log(`Connection attempt ${i} failed: ${err.message}`);
      if (i === retries) throw err;
      console.log(`Waiting ${delayMs / 1000}s for Neon compute to wake up...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  const c = await getClientWithRetry();
  try {
    await c.query('BEGIN');

    // Find the 2 teams
    const targetTeamsRes = await c.query(`
      SELECT id, team_code, team_name, status, pbl_cycle_id
      FROM teams_v2
      WHERE id IN (12, 15) OR LOWER(team_name) IN ('team1', 'alpha', 'alfa')
    `);

    const teams = targetTeamsRes.rows;
    console.log(`Found ${teams.length} target team(s) to delete:`);
    teams.forEach((t: any) => console.log(`  - ID ${t.id}: ${t.team_code} (${t.team_name}), status: ${t.status}`));

    if (teams.length === 0) {
      console.log('No matching teams found (already deleted).');
      await c.query('ROLLBACK');
      return;
    }

    const teamIds = teams.map((t: any) => Number(t.id));

    // 1. Delete review submissions and items for these teams
    await c.query(`
      DELETE FROM team_review_submission_items_v4
      WHERE submission_id IN (SELECT id FROM team_review_submissions_v4 WHERE team_id = ANY($1::bigint[]))
    `, [teamIds]);
    await c.query(`DELETE FROM team_review_submissions_v4 WHERE team_id = ANY($1::bigint[])`, [teamIds]);

    // 2. Delete evaluations, contributions, rubric scores for these teams
    await c.query(`DELETE FROM rubric_pdf_access_log_v4 WHERE evaluation_id IN (SELECT id FROM review_evaluations_v3 WHERE team_id = ANY($1::bigint[]))`, [teamIds]);
    await c.query(`DELETE FROM review_verification_actions_v3 WHERE evaluation_id IN (SELECT id FROM review_evaluations_v3 WHERE team_id = ANY($1::bigint[]))`, [teamIds]);
    await c.query(`DELETE FROM student_contributions_v3 WHERE evaluation_id IN (SELECT id FROM review_evaluations_v3 WHERE team_id = ANY($1::bigint[]))`, [teamIds]);
    await c.query(`DELETE FROM team_rubric_scores_v3 WHERE evaluation_id IN (SELECT id FROM review_evaluations_v3 WHERE team_id = ANY($1::bigint[]))`, [teamIds]);
    await c.query(`DELETE FROM review_evaluations_v3 WHERE team_id = ANY($1::bigint[])`, [teamIds]);
    await c.query(`DELETE FROM review_scores_v2 WHERE team_id = ANY($1::bigint[])`, [teamIds]);

    // 3. Delete project allocations, applications, and guide requests for these teams
    const delAlloc = await c.query(`DELETE FROM project_allocations_v2 WHERE team_id = ANY($1::bigint[])`, [teamIds]);
    const delApps = await c.query(`DELETE FROM project_applications_v2 WHERE team_id = ANY($1::bigint[])`, [teamIds]);
    const delGuideReq = await c.query(`DELETE FROM guide_requests_v2 WHERE team_id = ANY($1::bigint[])`, [teamIds]);

    // 4. Delete student-created projects owned by these teams
    const delProj = await c.query(`DELETE FROM projects_v2 WHERE owner_team_id = ANY($1::bigint[])`, [teamIds]);

    // 5. Delete team members for these teams (frees the 8 students for new team creation)
    const delMembers = await c.query(`DELETE FROM team_members_v2 WHERE team_id = ANY($1::bigint[])`, [teamIds]);

    // 6. Delete the teams from teams_v2
    const delTeams = await c.query(`DELETE FROM teams_v2 WHERE id = ANY($1::bigint[])`, [teamIds]);

    await c.query('COMMIT');

    console.log('\n=== Deletion Summary ===');
    console.log(`- Teams deleted:               ${delTeams.rowCount} (Team1, Alpha)`);
    console.log(`- Team memberships removed:    ${delMembers.rowCount} (students freed up)`);
    console.log(`- Student projects removed:    ${delProj.rowCount}`);
    console.log(`- Allocations removed:         ${delAlloc.rowCount}`);
    console.log(`- Applications removed:        ${delApps.rowCount}`);
    console.log(`- Guide requests removed:      ${delGuideReq.rowCount}`);
    console.log('========================\n');

    // Confirm total remaining teams
    const remainingTeams = await c.query('SELECT count(*)::int as count FROM teams_v2');
    const remainingStudents = await c.query('SELECT count(*)::int as count FROM students_v2');
    console.log(`Remaining teams in database:   ${remainingTeams.rows[0].count}`);
    console.log(`Total students (untouched):    ${remainingStudents.rows[0].count}`);

  } catch (err) {
    await c.query('ROLLBACK');
    console.error('Error deleting teams, transaction rolled back:', err);
    throw err;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
