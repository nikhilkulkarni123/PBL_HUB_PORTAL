const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/falcon_pbl' });
async function check() {
  const res = await pool.query('SELECT u.id, u.username, u.must_change_password, u.last_login_at, u.password_changed_at, array_agg(r.code) roles FROM users_v2 u LEFT JOIN user_roles_v2 ur ON ur.user_id=u.id LEFT JOIN roles_v2 r ON r.id=ur.role_id WHERE u.last_login_at IS NOT NULL GROUP BY u.id;');
  console.log('LOGGED IN USERS:\n' + JSON.stringify(res.rows, null, 2));
  const falseUsers = await pool.query('SELECT u.id, u.username, u.must_change_password, u.last_login_at, u.password_changed_at, array_agg(r.code) roles FROM users_v2 u LEFT JOIN user_roles_v2 ur ON ur.user_id=u.id LEFT JOIN roles_v2 r ON r.id=ur.role_id WHERE u.must_change_password=false GROUP BY u.id;');
  console.log('MUST_CHANGE_PASSWORD=FALSE USERS:\n' + JSON.stringify(falseUsers.rows, null, 2));
  await pool.end();
}
check().catch(console.error);
