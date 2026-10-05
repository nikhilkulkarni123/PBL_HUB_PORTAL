import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';
import { parseCSV } from '../lib/csv';

export type GMITStudentInput = {
  usn: string;
  name: string;
  semester: number;
  section?: string;
};

async function loadStudentData(): Promise<GMITStudentInput[]> {
  const possiblePaths = [
    path.join(process.cwd(), 'seed-data', 'gmit_students.json'),
    path.join(process.cwd(), 'source-data', 'gmit_students.json'),
    path.join(process.cwd(), 'source-data', 'gmit_students.csv'),
    path.join(process.cwd(), 'seed-data', 'gmit_students.csv'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Found GMIT student data file: ${p}`);
      if (p.endsWith('.json')) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const list = Array.isArray(raw) ? raw : (raw.students || []);
        return list.map((item: any) => ({
          usn: String(item.usn || item.USN || item.Usn || '').trim().toUpperCase(),
          name: String(item.name || item.NAME || item.Name || item.student_name || '').trim(),
          semester: Number(item.semester || item.sem || item.Semester || item.Sem || 0),
          section: String(item.section || item.Section || item.sec || 'A').trim().toUpperCase(),
        }));
      } else if (p.endsWith('.csv')) {
        const rows = parseCSV(fs.readFileSync(p, 'utf8'));
        return rows.map((r: any) => ({
          usn: String(r['USN'] || r['Usn'] || r['usn'] || '').trim().toUpperCase(),
          name: String(r['Name'] || r['NAME'] || r['name'] || r['Student Name'] || '').trim(),
          semester: Number(r['Semester'] || r['Sem'] || r['sem'] || r['semester'] || 0),
          section: String(r['Section'] || r['sec'] || r['section'] || 'A').trim().toUpperCase(),
        }));
      }
    }
  }

  throw new Error(
    'No GMIT student data file found! Please place gmit_students.json or gmit_students.csv in seed-data/ or source-data/.'
  );
}

export async function runGMITImport() {
  console.log('=== Falcon PBL Project Hub — Safe GMIT Student Import ===');
  console.log('Mode: Non-destructive, additive only.');
  console.log('Default Password: gmit@123 (must_change_password=true, is_active=true)');
  console.log('---------------------------------------------------------');

  const students = await loadStudentData();
  console.log(`Loaded ${students.length} records from file.`);

  const client = await pool.connect();
  const duplicateReports: { usn: string; name: string; reason: string }[] = [];
  const invalidReports: { record: any; reason: string }[] = [];
  const credentialsOut: string[] = ['role,username,name,institution,semester,section,temporary_password,must_change,status'];

  let importedCount = 0;
  let skippedDuplicateCount = 0;

  try {
    await client.query('BEGIN');

    // 1. Ensure STUDENT role exists
    const roleRes = await client.query("SELECT id FROM roles_v2 WHERE code='STUDENT'");
    if (!roleRes.rows[0]) {
      throw new Error("Role 'STUDENT' not found in roles_v2. Database might not be initialized.");
    }
    const studentRoleId = Number(roleRes.rows[0].id);

    // 2. Ensure GMIT program exists
    await client.query(`
      INSERT INTO programs_v2 (code, name, department)
      VALUES ('GMIT-CSE', 'GMIT Computer Science & Engineering', 'CSE')
      ON CONFLICT (code) DO NOTHING
    `);
    const gmitProgId = Number((await client.query("SELECT id FROM programs_v2 WHERE code='GMIT-CSE'")).rows[0].id);

    // 3. Ensure active academic cycle exists (default 2026-27 ODD)
    let cycleRow = (await client.query("SELECT id FROM academic_cycles_v2 WHERE is_active=true ORDER BY id DESC LIMIT 1")).rows[0];
    if (!cycleRow) {
      cycleRow = (await client.query(`
        INSERT INTO academic_cycles_v2 (name, season, is_active)
        VALUES ('2026-27', 'ODD', true)
        ON CONFLICT (name) DO UPDATE SET season=EXCLUDED.season RETURNING id
      `)).rows[0];
    }
    const cycleId = Number(cycleRow.id);

    // 4. Ensure GMIT PBL Cycles exist for Sem 3, 5, 7
    for (const sem of [3, 5, 7]) {
      await client.query(`
        INSERT INTO pbl_cycles_v2 (academic_cycle_id, program_id, semester, team_min_size, team_max_size, status)
        VALUES ($1, $2, $3, 3, 6, 'DRAFT')
        ON CONFLICT (academic_cycle_id, program_id, semester) DO NOTHING
      `, [cycleId, gmitProgId, sem]);
    }

    // 5. Hash the default password gmit@123 once with bcrypt (cost factor 12)
    const defaultPasswordHash = await bcrypt.hash('gmit@123', 12);

    // 6. Section cache for quick ID lookup
    const sectionCache = new Map<string, number>();
    const getSectionId = async (semester: number, sectionCode: string): Promise<number> => {
      const key = `${semester}|${sectionCode}`;
      if (sectionCache.has(key)) return sectionCache.get(key)!;
      const res = await client.query(`
        INSERT INTO sections_v2 (program_id, academic_cycle_id, semester, code)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (program_id, academic_cycle_id, semester, code)
        DO UPDATE SET code=EXCLUDED.code RETURNING id
      `, [gmitProgId, cycleId, semester, sectionCode]);
      const id = Number(res.rows[0].id);
      sectionCache.set(key, id);
      return id;
    };

    // 7. Process each student safely
    const semCounts: Record<number, number> = { 3: 0, 5: 0, 7: 0 };

    for (const s of students) {
      const usn = s.usn.trim().toUpperCase();
      const name = s.name.trim();
      const sem = Number(s.semester);
      const section = (s.section || 'A').trim().toUpperCase();

      if (!usn || !name || ![3, 5, 7].includes(sem)) {
        invalidReports.push({ record: s, reason: 'Invalid or missing USN/Name/Semester (must be 3, 5, or 7)' });
        continue;
      }

      const username = usn.toLowerCase();

      // Check if user already exists in users_v2 (by username)
      const existingUser = (await client.query('SELECT id, username FROM users_v2 WHERE username=$1', [username])).rows[0];
      // Check if student already exists in students_v2 (by USN)
      const existingStudent = (await client.query('SELECT id, usn, user_id FROM students_v2 WHERE usn=$1', [usn])).rows[0];

      if (existingUser || existingStudent) {
        duplicateReports.push({
          usn,
          name,
          reason: existingUser ? `Matching user '${username}' already exists` : `Matching USN '${usn}' already exists`,
        });
        skippedDuplicateCount++;
        continue; // CRITICAL REQUIREMENT: Do NOT overwrite matching accounts!
      }

      // Create new user account in users_v2
      const newUser = (await client.query(`
        INSERT INTO users_v2 (username, password_hash, display_name, must_change_password, is_active)
        VALUES ($1, $2, $3, true, true)
        RETURNING id
      `, [username, defaultPasswordHash, name])).rows[0];
      const userId = Number(newUser.id);

      // Assign STUDENT role
      await client.query(`
        INSERT INTO user_roles_v2 (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [userId, studentRoleId]);

      // Create student in students_v2 (DOB, mother_name, mentor left null)
      const newStudent = (await client.query(`
        INSERT INTO students_v2 (user_id, usn, name, institution, is_active)
        VALUES ($1, $2, $3, 'GMIT', true)
        RETURNING id
      `, [userId, usn, name])).rows[0];
      const studentId = Number(newStudent.id);

      // Link to section & enrollment
      const sectionId = await getSectionId(sem, section);
      await client.query(`
        INSERT INTO student_enrollments_v2 (student_id, academic_cycle_id, program_id, semester, section_id, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        ON CONFLICT (student_id, academic_cycle_id, semester) DO NOTHING
      `, [studentId, cycleId, gmitProgId, sem, sectionId]);

      credentialsOut.push([
        'STUDENT',
        username,
        `"${name.replaceAll('"', '""')}"`,
        'GMIT',
        String(sem),
        section,
        'gmit@123',
        'YES',
        'READY',
      ].join(','));

      semCounts[sem] = (semCounts[sem] || 0) + 1;
      importedCount++;
    }

    await client.query('COMMIT');

    // Write audit log / credentials file
    const credPath = path.join(process.cwd(), 'seed-data', 'gmit_imported_credentials.csv');
    fs.writeFileSync(credPath, credentialsOut.join('\n') + '\n');

    console.log('\n================ IMPORT SUMMARY ================');
    console.log(`Total scanned from input:     ${students.length}`);
    console.log(`Successfully imported:        ${importedCount}`);
    console.log(`Skipped duplicate USNs:       ${skippedDuplicateCount}`);
    console.log(`Invalid records rejected:     ${invalidReports.length}`);
    console.log('------------------------------------------------');
    console.log(`Semester 3 imported:          ${semCounts[3] || 0}`);
    console.log(`Semester 5 imported:          ${semCounts[5] || 0}`);
    console.log(`Semester 7 imported:          ${semCounts[7] || 0}`);
    console.log('------------------------------------------------');
    console.log(`Audit credentials written to: ${credPath}`);
    if (duplicateReports.length > 0) {
      console.log(`Duplicate USNs skipped (${duplicateReports.length}):`);
      duplicateReports.forEach((d) => console.log(`  - ${d.usn}: ${d.name} (${d.reason})`));
    }
    console.log('================================================\n');

    return {
      total: students.length,
      imported: importedCount,
      duplicates: skippedDuplicateCount,
      invalid: invalidReports.length,
      semCounts,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed! Transaction rolled back completely. No data was modified.');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runGMITImport()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
