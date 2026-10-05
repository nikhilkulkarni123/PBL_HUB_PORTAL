const { Pool } = require('pg');

try {
  process.loadEnvFile();
} catch (e) {}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const teams = await pool.query(`
    SELECT t.id, t.team_code, t.team_name, t.status, t.pbl_cycle_id, pc.semester, ac.name as cycle_name
    FROM teams_v2 t
    JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
    JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id
    WHERE LOWER(t.team_name) IN ('team1', 'alfa') OR LOWER(t.team_code) IN ('team1', 'alfa')
  `);

  console.log('Matching teams found:');
  console.log(JSON.stringify(teams.rows, null, 2));

  if (teams.rows.length === 0) {
    console.log('No exact matches. Listing all current teams in teams_v2:');
    const all = await pool.query('SELECT id, team_code, team_name, status FROM teams_v2');
    console.log(JSON.stringify(all.rows, null, 2));
    await pool.end();
    return;
  }

  const teamIds = teams.rows.map(t => t.id);

  // Check members
  const members = await pool.query(`
    SELECT tm.team_id, tm.member_role, s.usn, s.name
    FROM team_members_v2 tm
    JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
    JOIN students_v2 s ON s.id = e.student_id
    WHERE tm.team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Team members:', JSON.stringify(members.rows, null, 2));

  // Check allocations
  const alloc = await pool.query(`
    SELECT pa.id, pa.team_id, pa.project_id, pa.status, p.title
    FROM project_allocations_v2 pa
    JOIN projects_v2 p ON p.id = pa.project_id
    WHERE pa.team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Allocations:', JSON.stringify(alloc.rows, null, 2));

  // Check student-created projects
  const studentProj = await pool.query(`
    SELECT id, project_code, title, project_type, owner_team_id
    FROM projects_v2
    WHERE owner_team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Student projects owned by these teams:', JSON.stringify(studentProj.rows, null, 2));

  // Check submissions
  const subs = await pool.query(`
    SELECT id, review_id, team_id, status
    FROM team_review_submissions_v4
    WHERE team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Review submissions:', JSON.stringify(subs.rows, null, 2));

  // Check evaluations
  const evals = await pool.query(`
    SELECT id, review_id, team_id, status
    FROM review_evaluations_v3
    WHERE team_id = ANY($1::bigint[])
  `, [teamIds]);
  console.log('Evaluations:', JSON.stringify(evals.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
