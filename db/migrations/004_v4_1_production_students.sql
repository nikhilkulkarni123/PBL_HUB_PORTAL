-- Falcon PBL Project Hub V4.1
-- Additive profile fields used for production student onboarding.
ALTER TABLE students_v2 ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE students_v2 ADD COLUMN IF NOT EXISTS mother_name VARCHAR(180);

CREATE INDEX IF NOT EXISTS idx_students_v2_active_usn ON students_v2(is_active, usn);
CREATE INDEX IF NOT EXISTS idx_enrollments_v2_sem_section ON student_enrollments_v2(semester, section_id, status);
