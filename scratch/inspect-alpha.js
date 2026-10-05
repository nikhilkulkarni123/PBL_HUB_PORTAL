const { Pool } = require('pg');

try {
  process.loadEnvFile();
} catch (e) {}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const teamIds = [12, 15];

  const teams = await pool.query('SELECT id, team_code, team_name, status, pbl_cycle_id FROM teams_v2 WHERE id = ANY($1::bigint[])', [teamIds]);
  console.log('Teams:', teams.rows);

  const members = await pool.query(`
    SELECT tm.team_id, tm.member_role, s.usn, s.name
    FROM team_members_v2 tm
    JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
    JOIN students_v2 s ON s.id = e.student_id
    WHERE tm.team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Members:', members.rows);

  const alloc = await pool.query(`
    SELECT pa.id, pa.team_id, pa.project_id, pa.status, p.title, p.project_code
    FROM project_allocations_v2 pa
    JOIN projects_v2 p ON p.id = pa.project_id
    WHERE pa.team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Allocations:', alloc.rows);

  const studentProj = await pool.query(`
    SELECT id, project_code, title, project_type, owner_team_id
    FROM projects_v2
    WHERE owner_team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Student projects owned:', studentProj.rows);

  const apps = await pool.query(`
    SELECT id, team_id, project_id, status FROM project_applications_v2 WHERE team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Applications:', apps.rows);

  const guideReq = await pool.query(`
    SELECT id, team_id, project_id, status FROM guide_requests_v2 WHERE team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Guide requests:', guideReq.rows);

  const subs = await pool.query(`
    SELECT id, review_id, team_id, status FROM team_review_submissions_v4 WHERE team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Submissions:', subs.rows);

  const evals = await pool.query(`
    SELECT id, review_id, team_id, status FROM review_evaluations_v3 WHERE team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Evaluations:', evals.rows);

  await pool.end();
}

main().catch(console.error);
