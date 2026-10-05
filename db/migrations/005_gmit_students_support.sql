-- Falcon PBL Project Hub V4.1.1 — GMIT Student Integration Support
-- 100% additive and non-destructive.
-- Retains all existing GMU student, faculty, password, cycle, team, project, review and submission data.

-- 1. Add institution discriminator to students_v2 (defaults to 'GMU' for all existing records)
ALTER TABLE students_v2 ADD COLUMN IF NOT EXISTS institution VARCHAR(40) DEFAULT 'GMU';
UPDATE students_v2 SET institution = 'GMU' WHERE institution IS NULL;

-- 2. Add GMIT program to programs_v2
INSERT INTO programs_v2 (code, name, department)
VALUES ('GMIT-CSE', 'GMIT Computer Science & Engineering', 'CSE')
ON CONFLICT (code) DO NOTHING;

-- 3. Create index for fast institution-level querying
CREATE INDEX IF NOT EXISTS idx_students_v2_institution_usn ON students_v2(institution, usn);

-- 4. Ensure PBL Cycles exist for GMIT in active academic cycle for Semesters 3, 5, 7 (min 3, max 6)
DO $$
DECLARE
  v_cycle_id INT;
  v_prog_id INT;
BEGIN
  SELECT id INTO v_cycle_id FROM academic_cycles_v2 WHERE is_active = true ORDER BY id DESC LIMIT 1;
  SELECT id INTO v_prog_id FROM programs_v2 WHERE code = 'GMIT-CSE';

  IF v_cycle_id IS NOT NULL AND v_prog_id IS NOT NULL THEN
    INSERT INTO pbl_cycles_v2 (academic_cycle_id, program_id, semester, team_min_size, team_max_size, status)
    VALUES 
      (v_cycle_id, v_prog_id, 3, 3, 6, 'DRAFT'),
      (v_cycle_id, v_prog_id, 5, 3, 6, 'DRAFT'),
      (v_cycle_id, v_prog_id, 7, 3, 6, 'DRAFT')
    ON CONFLICT (academic_cycle_id, program_id, semester) DO NOTHING;
  END IF;
END $$;

-- 5. Set team size rule: minimum 3, maximum 6 across all cycles
UPDATE pbl_cycles_v2 SET team_min_size = 3, team_max_size = 6;
ALTER TABLE pbl_cycles_v2 ALTER COLUMN team_min_size SET DEFAULT 3;
ALTER TABLE pbl_cycles_v2 ALTER COLUMN team_max_size SET DEFAULT 6;

