const { Pool } = require('pg');

try {
  process.loadEnvFile();
} catch (e) {}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Updating team size rules in pbl_cycles_v2 to min 3, max 6...');

  const updateRes = await pool.query(`
    UPDATE pbl_cycles_v2 SET team_min_size = 3, team_max_size = 6 RETURNING id, program_id, semester, team_min_size, team_max_size;
  `);
  console.log(`Updated ${updateRes.rowCount} PBL cycles:`);
  console.log(JSON.stringify(updateRes.rows, null, 2));

  await pool.query(`
    ALTER TABLE pbl_cycles_v2 ALTER COLUMN team_min_size SET DEFAULT 3;
    ALTER TABLE pbl_cycles_v2 ALTER COLUMN team_max_size SET DEFAULT 6;
  `);
  console.log('Altered column defaults successfully.');

  await pool.end();
}

main().catch(console.error);
