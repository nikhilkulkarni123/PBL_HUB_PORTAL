import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';

async function main() {
  const args = process.argv.slice(2);
  const employeeId = (args[0] || 'EC26064').trim().toUpperCase();
  const name = (args.slice(1).join(' ') || 'YASHASWINI N S').trim().toUpperCase();
  const username = employeeId.toLowerCase();
  const defaultPassword = 'falcon@123';

  console.log(`Adding faculty member: ${name} (${employeeId})...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if already exists in users_v2 or faculty_v2
    const existingUser = (await client.query('SELECT id, username FROM users_v2 WHERE username = $1', [username])).rows[0];
    const existingFaculty = (await client.query('SELECT id, employee_id FROM faculty_v2 WHERE employee_id = $1', [employeeId])).rows[0];

    let userId: number;

    if (existingUser) {
      console.log(`User ${username} already exists (id: ${existingUser.id}), updating display name...`);
      userId = Number(existingUser.id);
      await client.query(
        'UPDATE users_v2 SET display_name = $1, is_active = true, updated_at = NOW() WHERE id = $2',
        [name, userId]
      );
    } else {
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      const insertUserRes = await client.query(
        `INSERT INTO users_v2 (username, password_hash, display_name, must_change_password, is_active)
         VALUES ($1, $2, $3, true, true)
         RETURNING id`,
        [username, passwordHash, name]
      );
      userId = Number(insertUserRes.rows[0].id);
      console.log(`Created user ${username} with ID: ${userId}`);
    }

    // 2. Ensure FACULTY role in user_roles_v2
    const facultyRoleRes = await client.query("SELECT id FROM roles_v2 WHERE code = 'FACULTY'");
    if (facultyRoleRes.rows.length > 0) {
      const roleId = facultyRoleRes.rows[0].id;
      await client.query(
        'INSERT INTO user_roles_v2 (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, roleId]
      );
      console.log(`Assigned role FACULTY (id: ${roleId}) to user ${userId}`);
    }

    // 3. Upsert faculty_v2 record
    let facultyId: number;
    if (existingFaculty) {
      console.log(`Faculty ${employeeId} already exists (id: ${existingFaculty.id}), updating...`);
      facultyId = Number(existingFaculty.id);
      await client.query(
        `UPDATE faculty_v2 SET user_id = $1, name = $2, is_active = true WHERE id = $3`,
        [userId, name, facultyId]
      );
    } else {
      const insertFacRes = await client.query(
        `INSERT INTO faculty_v2 (user_id, employee_id, name, department, is_active, source)
         VALUES ($1, $2, $3, 'CSE', true, 'FACULTY_MASTER')
         RETURNING id`,
        [userId, employeeId, name]
      );
      facultyId = Number(insertFacRes.rows[0].id);
      console.log(`Created faculty record with ID: ${facultyId}`);
    }

    // 4. Set Guide Limits for active academic cycles & PBL cycles
    const academicCycles = await client.query('SELECT id FROM academic_cycles_v2 WHERE is_active = true');
    for (const ac of academicCycles.rows) {
      await client.query(
        `INSERT INTO faculty_guide_limits_v2 (academic_cycle_id, faculty_id, overall_max_projects)
         VALUES ($1, $2, 6)
         ON CONFLICT (academic_cycle_id, faculty_id) DO NOTHING`,
        [ac.id, facultyId]
      );
    }

    const pblCycles = await client.query('SELECT id FROM pbl_cycles_v2');
    for (const pc of pblCycles.rows) {
      await client.query(
        `INSERT INTO faculty_semester_guide_limits_v2 (pbl_cycle_id, faculty_id, max_projects)
         VALUES ($1, $2, 3)
         ON CONFLICT (pbl_cycle_id, faculty_id) DO NOTHING`,
        [pc.id, facultyId]
      );
    }
    console.log(`Configured guide limits (overall: 6, per semester: 3) for faculty ID: ${facultyId}`);

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');

    // 5. Verification query
    const verifyRes = await client.query(`
      SELECT f.id as faculty_id, f.employee_id, f.name as faculty_name, f.department, f.is_active,
             u.id as user_id, u.username, u.must_change_password, r.code as role
      FROM faculty_v2 f
      JOIN users_v2 u ON u.id = f.user_id
      LEFT JOIN user_roles_v2 ur ON ur.user_id = u.id
      LEFT JOIN roles_v2 r ON r.id = ur.role_id
      WHERE f.employee_id = $1
    `, [employeeId]);

    console.log('Verified faculty record:', verifyRes.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding faculty, transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
