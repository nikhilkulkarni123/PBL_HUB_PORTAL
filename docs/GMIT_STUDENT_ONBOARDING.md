# GMIT Student Onboarding & Integration — Falcon PBL Project Hub

This document describes the non-destructive, additive integration of **GMIT (GM Institute of Technology)** students into the Falcon PBL Project Hub.

---

## 1. Principles & Safeguards

- **Zero Data Loss**: All existing 246 GMU students, 23 GMU faculty, team memberships, projects, allocations, reviews, rubrics, and password hashes remain untouched.
- **Strict Partitioning**: GMIT students are registered under `institution = 'GMIT'` and enrolled in the `GMIT-CSE` program (`programs_v2`).
- **Team Isolation**: Team creation is filtered by `program_id` and `pbl_cycle_id`, ensuring GMU and GMIT students are never cross-assigned or mixed in team creation.
- **Deduplication Safeguard**: If any USN already exists in `users_v2` or `students_v2`, the import script **skips** it and logs it. It will **never** overwrite an existing account.
- **Safe Password Policy**: GMIT students use:
  - **Username**: USN (lowercase)
  - **Default Password**: `gmit@123`
  - **Account Status**: Active (`is_active = true`)
  - **Must Change Password**: `true` (forces password change on first login)
  - **DOB, Mother's Name, Mentor**: Blank (`NULL`) for now

---

## 2. Minimum Required Schema Migration

File: `db/migrations/005_gmit_students_support.sql`

1. Adds column `institution VARCHAR(40) DEFAULT 'GMU'` to `students_v2` without modifying existing rows.
2. Registers `programs_v2` entry `GMIT-CSE` ('GMIT Computer Science & Engineering', Department 'CSE').
3. Adds index `idx_students_v2_institution_usn` on `(institution, usn)`.
4. Creates PBL Cycles for Semesters 3, 5, and 7 under `GMIT-CSE` for the active academic cycle with team size limits (4–6).

---

## 3. Data File Placement

Place the GMIT student data file in one of the following locations:
- `source-data/gmit_students.csv`
- `seed-data/gmit_students.json`

Required fields per record:
- **USN**: Student university seat number (e.g. `4GM23CS001`)
- **Name**: Student full name
- **Semester**: `3`, `5`, or `7`
- **Section**: Section identifier (e.g. `A`, `B`, `C`)

---

## 4. Execution Workflow

### Step 1: Run Additive Migration
```bash
npm run db:upgrade-gmit
```

### Step 2: Run One-Time Import
```bash
npm run db:import-gmit
```

### Step 3: Run Automated Verification
```bash
npm run db:verify-gmit
```

---

## 5. Verification Queries

You can also run these direct SQL queries against your PostgreSQL / Neon database:

```sql
-- 1. Verify GMU count is unchanged (246 students)
SELECT COUNT(*) FROM students_v2 WHERE institution = 'GMU' OR institution IS NULL;

-- 2. Verify GMIT student count (337 students)
SELECT COUNT(*) FROM students_v2 WHERE institution = 'GMIT';

-- 3. Verify GMIT semester distribution (Sem 3, 5, 7)
SELECT e.semester, COUNT(*) 
FROM students_v2 s 
JOIN student_enrollments_v2 e ON e.student_id = s.id 
WHERE s.institution = 'GMIT' 
GROUP BY e.semester 
ORDER BY e.semester;

-- 4. Verify approved GMU faculty count is untouched (23 faculty)
SELECT COUNT(*) FROM faculty_v2;

-- 5. Verify no cross-program leakage
SELECT COUNT(*) 
FROM student_enrollments_v2 e 
JOIN students_v2 s ON s.id = e.student_id 
JOIN programs_v2 p ON p.id = e.program_id 
WHERE (s.institution = 'GMIT' AND p.code != 'GMIT-CSE') 
   OR ((s.institution = 'GMU' OR s.institution IS NULL) AND p.code = 'GMIT-CSE');
```
