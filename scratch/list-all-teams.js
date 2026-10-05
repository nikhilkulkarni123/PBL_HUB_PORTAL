const { Pool } = require('pg');

try {
  process.loadEnvFile();
} catch (e) {}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const all = await pool.query(`
    SELECT t.id, t.team_code, t.team_name, t.status, pc.semester, pr.code as program_code
    FROM teams_v2 t
    JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
    JOIN programs_v2 pr ON pr.id = pc.program_id
    ORDER BY t.id
  `);
  console.log('ALL TEAMS IN DATABASE:');
  console.log(JSON.stringify(all.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
