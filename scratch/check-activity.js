const { Pool } = require('pg');

try {
  process.loadEnvFile();
} catch (e) {}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT pid, state, wait_event_type, wait_event, query_start, query
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid() AND state != 'idle'
  `);
  console.log('Active queries on PostgreSQL:');
  console.log(JSON.stringify(res.rows, null, 2));

  const gmitCount = await pool.query("SELECT COUNT(*) FROM students_v2 WHERE institution = 'GMIT'");
  console.log('Current GMIT count in students_v2:', gmitCount.rows[0].count);

  const gmuCount = await pool.query("SELECT COUNT(*) FROM students_v2 WHERE institution = 'GMU' OR institution IS NULL");
  console.log('Current GMU count in students_v2:', gmuCount.rows[0].count);

  await pool.end();
}

main().catch(console.error);
