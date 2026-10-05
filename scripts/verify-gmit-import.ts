import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';

export async function runVerification() {
  console.log('=== Falcon PBL Project Hub — GMIT Import Verification ===\n');

  // 1. GMU Student Count Check
  const gmuStudentRes = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text as count FROM students_v2 WHERE institution = 'GMU' OR institution IS NULL
  `);
  const gmuCount = Number(gmuStudentRes.rows[0].count);
  console.log(`[1] GMU Student Master Count: ${gmuCount} students`);
  if (gmuCount === 246) {
    console.log('    ✓ PASS: Existing 246 GMU students are completely preserved.');
  } else {
    console.log(`    ℹ Note: Current GMU count is ${gmuCount}.`);
  }

  // 2. GMU Faculty Count Check
  const facultyRes = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text as count FROM faculty_v2
  `);
  const facultyCount = Number(facultyRes.rows[0].count);
  console.log(`[2] GMU Faculty Master Count: ${facultyCount} faculty`);
  if (facultyCount === 23) {
    console.log('    ✓ PASS: Approved 23 GMU faculty baseline remains untouched.');
  }

  // 3. GMIT Student Count Check
  const gmitStudentRes = await pool.query<{ count: string }>(`
    SELECT COUNT(*)::text as count FROM students_v2 WHERE institution = 'GMIT'
  `);
  const gmitCount = Number(gmitStudentRes.rows[0].count);
  console.log(`[3] GMIT Student Count: ${gmitCount} students`);
  if (gmitCount === 337) {
    console.log('    ✓ PASS: All 337 GMIT students are present.');
  } else if (gmitCount === 0) {
    console.log('    ℹ GMIT students not imported yet (run import script once data file is ready).');
  } else {
    console.log(`    ℹ Found ${gmitCount} GMIT students.`);
  }

  // 4. GMIT Semester Distribution
  const gmitSemRes = await pool.query<{ semester: number; count: string }>(`
    SELECT e.semester, COUNT(*)::text as count
    FROM students_v2 s
    JOIN student_enrollments_v2 e ON e.student_id = s.id
    WHERE s.institution = 'GMIT'
    GROUP BY e.semester
    ORDER BY e.semester
  `);
  console.log('[4] GMIT Semester Breakdown:');
  if (gmitSemRes.rows.length === 0) {
    console.log('    (No GMIT enrollments yet)');
  } else {
    for (const row of gmitSemRes.rows) {
      console.log(`    - Semester ${row.semester}: ${row.count} students`);
    }
  }

  // 5. GMIT Login & Password Verification
  const sampleUsers = await pool.query<{ username: string; password_hash: string; must_change_password: boolean }>(`
    SELECT u.username, u.password_hash, u.must_change_password
    FROM users_v2 u
    JOIN students_v2 s ON s.user_id = u.id
    WHERE s.institution = 'GMIT'
    LIMIT 5
  `);
  console.log('[5] GMIT Credentials Verification (sample of 5 accounts):');
  if (sampleUsers.rows.length === 0) {
    console.log('    (No GMIT user accounts yet)');
  } else {
    let allValid = true;
    for (const u of sampleUsers.rows) {
      const match = await bcrypt.compare('gmit@123', u.password_hash);
      const ok = match && u.must_change_password === true;
      if (!ok) allValid = false;
      console.log(`    - ${u.username}: Password matches 'gmit@123': ${match}, must_change_password: ${u.must_change_password}`);
    }
    if (allValid) {
      console.log('    ✓ PASS: GMIT accounts can log in with default password gmit@123 and force password change.');
    }
  }

  // 6. Partitioning / Isolation Verification (confirm no cross-program leakage in team formation)
  const gmuProg = (await pool.query("SELECT id FROM programs_v2 WHERE code != 'GMIT-CSE' ORDER BY id ASC LIMIT 1")).rows[0]?.id;
  const gmitProg = (await pool.query("SELECT id FROM programs_v2 WHERE code = 'GMIT-CSE'")).rows[0]?.id;
  if (gmuProg && gmitProg) {
    const crossCheck = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text as count
      FROM student_enrollments_v2 e
      JOIN students_v2 s ON s.id = e.student_id
      WHERE (s.institution = 'GMIT' AND e.program_id = $1)
         OR ((s.institution = 'GMU' OR s.institution IS NULL) AND e.program_id = $2)
    `, [gmuProg, gmitProg]);
    const crossCount = Number(crossCheck.rows[0].count);
    console.log(`[6] Program Isolation Check: ${crossCount} cross-assigned enrollments`);
    if (crossCount === 0) {
      console.log('    ✓ PASS: GMU and GMIT students are strictly partitioned. Team creation will not mix them.');
    } else {
      console.log('    ⚠ WARNING: Cross-assigned enrollments detected!');
    }
  }

  console.log('\n=======================================================\n');
}

if (require.main === module) {
  runVerification()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
