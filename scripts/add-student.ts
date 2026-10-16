import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';

async function main() {
  const args = process.argv.slice(2);
  const usn = (args[0] || 'U23E01CS011').trim().toUpperCase();
  const name = (args[1] || 'DARSHAN M').trim().toUpperCase();
  const semester = Number(args[2] || 7);
  const sectionCode = (args[3] || 'CS4A').trim().toUpperCase();
  const username = usn.toLowerCase();
  const yearOfStudy = Math.ceil(semester / 2);
  const defaultPassword = 'falcon@123';

  console.log(`Adding student: ${name} (${usn}) - Sem ${semester}, Section ${sectionCode}...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolve role, program, academic cycle, section, and mentor
    const studentRoleRes = await client.query("SELECT id FROM roles_v2 WHERE code = 'STUDENT'");
    if (!studentRoleRes.rows[0]) throw new Error("Role 'STUDENT' not found");
    const roleId = Number(studentRoleRes.rows[0].id);

    const progRes = await client.query("SELECT id FROM programs_v2 WHERE code = 'CSE'");
    if (!progRes.rows[0]) throw new Error("Program 'CSE' not found");
    const programId = Number(progRes.rows[0].id);

    const cycleRes = await client.query("SELECT id FROM academic_cycles_v2 WHERE is_active = true ORDER BY id DESC LIMIT 1");
    if (!cycleRes.rows[0]) throw new Error("Active academic cycle not found");
    const academicCycleId = Number(cycleRes.rows[0].id);

    const secRes = await client.query(
      "SELECT id FROM sections_v2 WHERE program_id = $1 AND academic_cycle_id = $2 AND semester = $3 AND code = $4",
      [programId, academicCycleId, semester, sectionCode]
    );
    if (!secRes.rows[0]) throw new Error(`Section ${sectionCode} for semester ${semester} not found`);
    const sectionId = Number(secRes.rows[0].id);

    // Mentor for CS4A (EC25037 - KAVYASHREE P N)
    const mentorRes = await client.query("SELECT id FROM faculty_v2 WHERE employee_id = 'EC25037'");
    const mentorFacultyId = mentorRes.rows[0] ? Number(mentorRes.rows[0].id) : null;

    // 2. Ensure user in users_v2
    let existingUser = (await client.query("SELECT id FROM users_v2 WHERE username = $1", [username])).rows[0];
    let userId: number;

    if (existingUser) {
      userId = Number(existingUser.id);
      console.log(`User ${username} already exists (id: ${userId}), updating...`);
      await client.query(
        "UPDATE users_v2 SET display_name = $1, is_active = true, updated_at = NOW() WHERE id = $2",
        [name, userId]
      );
    } else {
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      const userInsert = await client.query(
        `INSERT INTO users_v2 (username, password_hash, display_name, must_change_password, is_active)
         VALUES ($1, $2, $3, true, true)
         RETURNING id`,
        [username, passwordHash, name]
      );
      userId = Number(userInsert.rows[0].id);
      console.log(`Created user ${username} with ID: ${userId}`);
    }

    // 3. Ensure role in user_roles_v2
    await client.query(
      "INSERT INTO user_roles_v2 (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, roleId]
    );

    // 4. Upsert into students_v2
    let existingStudent = (await client.query("SELECT id FROM students_v2 WHERE usn = $1", [usn])).rows[0];
    let studentId: number;

    if (existingStudent) {
      studentId = Number(existingStudent.id);
      console.log(`Student ${usn} already exists (id: ${studentId}), updating...`);
      await client.query(
        `UPDATE students_v2
         SET user_id = $1, name = $2, mentor_faculty_id = $3, is_active = true, institution = 'GMU'
         WHERE id = $4`,
        [userId, name, mentorFacultyId, studentId]
      );
    } else {
      const stuInsert = await client.query(
        `INSERT INTO students_v2 (user_id, usn, name, mentor_faculty_id, institution, is_active)
         VALUES ($1, $2, $3, $4, 'GMU', true)
         RETURNING id`,
        [userId, usn, name, mentorFacultyId]
      );
      studentId = Number(stuInsert.rows[0].id);
      console.log(`Created student ${usn} with ID: ${studentId}`);
    }

    // 5. Ensure enrollment in student_enrollments_v2
    await client.query(
      `INSERT INTO student_enrollments_v2 (student_id, academic_cycle_id, program_id, semester, section_id, year_of_study, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       ON CONFLICT (student_id, academic_cycle_id, semester)
       DO UPDATE SET section_id = EXCLUDED.section_id, year_of_study = EXCLUDED.year_of_study, status = 'ACTIVE'`,
      [studentId, academicCycleId, programId, semester, sectionId, yearOfStudy]
    );
    console.log(`Enrolled student in Sem ${semester}, Section ${sectionCode}.`);

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');

    // 6. Verification
    const verifyRes = await client.query(`
      SELECT s.id as student_id, s.usn, s.name, s.institution, s.mentor_faculty_id,
             u.id as user_id, u.username, u.is_active, u.must_change_password,
             e.semester, sec.code as section, f.name as mentor_name
      FROM students_v2 s
      JOIN users_v2 u ON u.id = s.user_id
      JOIN student_enrollments_v2 e ON e.student_id = s.id
      JOIN sections_v2 sec ON sec.id = e.section_id
      LEFT JOIN faculty_v2 f ON f.id = s.mentor_faculty_id
      WHERE s.usn = $1
    `, [usn]);

    console.log('Verified student record:', JSON.stringify(verifyRes.rows, null, 2));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to add student, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
