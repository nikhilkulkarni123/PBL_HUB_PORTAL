-- Falcon PBL Project Hub V2 refined schema.
-- Safe to apply after V1; V2 code uses *_v2 tables below to avoid destructive upgrades.
CREATE TABLE IF NOT EXISTS roles_v2 (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL CHECK (code IN ('HOD','PBL_COORDINATOR','FACULTY','STUDENT')),
  name VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS users_v2 (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  email VARCHAR(180),
  phone VARCHAR(30),
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_changed_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles_v2 (
  user_id BIGINT NOT NULL REFERENCES users_v2(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles_v2(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS academic_cycles_v2 (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) UNIQUE NOT NULL,
  season VARCHAR(20),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS programs_v2 (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  department VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS faculty_v2 (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users_v2(id) ON DELETE SET NULL,
  employee_id VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  designation VARCHAR(120),
  department VARCHAR(100) DEFAULT 'CSE',
  email VARCHAR(180),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source VARCHAR(40) DEFAULT 'FACULTY_MASTER'
);

CREATE TABLE IF NOT EXISTS students_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users_v2(id) ON DELETE SET NULL,
  usn VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(180),
  phone VARCHAR(30),
  mentor_faculty_id INT REFERENCES faculty_v2(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sections_v2 (
  id SERIAL PRIMARY KEY,
  program_id INT NOT NULL REFERENCES programs_v2(id),
  academic_cycle_id INT NOT NULL REFERENCES academic_cycles_v2(id),
  semester INT NOT NULL CHECK(semester BETWEEN 1 AND 12),
  code VARCHAR(30) NOT NULL,
  UNIQUE(program_id, academic_cycle_id, semester, code)
);

CREATE TABLE IF NOT EXISTS student_enrollments_v2 (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students_v2(id),
  academic_cycle_id INT NOT NULL REFERENCES academic_cycles_v2(id),
  program_id INT NOT NULL REFERENCES programs_v2(id),
  semester INT NOT NULL CHECK(semester BETWEEN 1 AND 12),
  section_id INT NOT NULL REFERENCES sections_v2(id),
  scheme INT,
  year_of_study INT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  UNIQUE(student_id, academic_cycle_id, semester)
);

CREATE TABLE IF NOT EXISTS pbl_coordinator_assignments_v2 (
  id SERIAL PRIMARY KEY,
  academic_cycle_id INT NOT NULL REFERENCES academic_cycles_v2(id),
  program_id INT NOT NULL REFERENCES programs_v2(id),
  semester INT NOT NULL,
  faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  assigned_from DATE DEFAULT CURRENT_DATE,
  assigned_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_coordinator_per_semester_v2
ON pbl_coordinator_assignments_v2(academic_cycle_id, program_id, semester)
WHERE is_active;

CREATE TABLE IF NOT EXISTS pbl_cycles_v2 (
  id SERIAL PRIMARY KEY,
  academic_cycle_id INT NOT NULL REFERENCES academic_cycles_v2(id),
  program_id INT NOT NULL REFERENCES programs_v2(id),
  semester INT NOT NULL,
  coordinator_assignment_id INT REFERENCES pbl_coordinator_assignments_v2(id),
  team_min_size INT NOT NULL DEFAULT 4 CHECK(team_min_size > 0),
  team_max_size INT NOT NULL DEFAULT 6 CHECK(team_max_size >= team_min_size),
  team_formation_open_at TIMESTAMPTZ,
  team_formation_close_at TIMESTAMPTZ,
  project_application_open_at TIMESTAMPTZ,
  project_application_close_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  UNIQUE(academic_cycle_id, program_id, semester)
);

CREATE TABLE IF NOT EXISTS faculty_guide_limits_v2 (
  id SERIAL PRIMARY KEY,
  academic_cycle_id INT NOT NULL REFERENCES academic_cycles_v2(id),
  faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  overall_max_projects INT NOT NULL DEFAULT 6 CHECK(overall_max_projects >= 0),
  UNIQUE(academic_cycle_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS faculty_semester_guide_limits_v2 (
  id SERIAL PRIMARY KEY,
  pbl_cycle_id INT NOT NULL REFERENCES pbl_cycles_v2(id) ON DELETE CASCADE,
  faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  max_projects INT NOT NULL DEFAULT 3 CHECK(max_projects >= 0),
  UNIQUE(pbl_cycle_id, faculty_id)
);

CREATE TABLE IF NOT EXISTS teams_v2 (
  id BIGSERIAL PRIMARY KEY,
  pbl_cycle_id INT NOT NULL REFERENCES pbl_cycles_v2(id),
  team_code VARCHAR(60) UNIQUE NOT NULL,
  team_name VARCHAR(160) NOT NULL,
  leader_enrollment_id BIGINT REFERENCES student_enrollments_v2(id),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','PROJECT_ASSIGNED','LOCKED','DISSOLVED','COMPLETED')),
  created_by BIGINT REFERENCES users_v2(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS team_members_v2 (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams_v2(id) ON DELETE CASCADE,
  enrollment_id BIGINT NOT NULL REFERENCES student_enrollments_v2(id),
  pbl_cycle_id INT NOT NULL REFERENCES pbl_cycles_v2(id),
  member_role VARCHAR(20) NOT NULL DEFAULT 'MEMBER' CHECK(member_role IN ('LEADER','MEMBER')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, enrollment_id),
  UNIQUE(enrollment_id, pbl_cycle_id)
);

CREATE OR REPLACE FUNCTION validate_team_member_v2() RETURNS TRIGGER AS $$
DECLARE team_cycle RECORD; enr RECORD;
BEGIN
  SELECT pc.id, pc.academic_cycle_id, pc.program_id, pc.semester INTO team_cycle
  FROM teams_v2 t JOIN pbl_cycles_v2 pc ON pc.id=t.pbl_cycle_id WHERE t.id=NEW.team_id;
  SELECT academic_cycle_id, program_id, semester INTO enr FROM student_enrollments_v2 WHERE id=NEW.enrollment_id;
  IF team_cycle.id IS NULL OR enr.academic_cycle_id IS NULL THEN RAISE EXCEPTION 'Invalid team or enrollment'; END IF;
  IF team_cycle.id <> NEW.pbl_cycle_id THEN RAISE EXCEPTION 'Team member PBL cycle mismatch'; END IF;
  IF team_cycle.academic_cycle_id <> enr.academic_cycle_id OR team_cycle.program_id <> enr.program_id OR team_cycle.semester <> enr.semester THEN
    RAISE EXCEPTION 'Student must belong to the same academic cycle, program and semester as the team';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_validate_team_member_v2 ON team_members_v2;
CREATE TRIGGER trg_validate_team_member_v2 BEFORE INSERT OR UPDATE ON team_members_v2 FOR EACH ROW EXECUTE FUNCTION validate_team_member_v2();

CREATE OR REPLACE FUNCTION validate_team_activation_v2() RETURNS TRIGGER AS $$
DECLARE n INT; min_n INT; max_n INT; leader_ok INT;
BEGIN
  IF NEW.status IN ('ACTIVE','PROJECT_ASSIGNED','LOCKED','COMPLETED') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT COUNT(*), pc.team_min_size, pc.team_max_size INTO n,min_n,max_n FROM team_members_v2 tm JOIN pbl_cycles_v2 pc ON pc.id=NEW.pbl_cycle_id WHERE tm.team_id=NEW.id AND tm.status='ACTIVE' GROUP BY pc.team_min_size,pc.team_max_size;
    n:=COALESCE(n,0);
    IF n < min_n OR n > max_n THEN RAISE EXCEPTION 'Team size % must be between % and %',n,min_n,max_n; END IF;
    SELECT COUNT(*) INTO leader_ok FROM team_members_v2 WHERE team_id=NEW.id AND enrollment_id=NEW.leader_enrollment_id AND member_role='LEADER';
    IF leader_ok <> 1 THEN RAISE EXCEPTION 'Team leader must be an active team member marked LEADER'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_validate_team_activation_v2 ON teams_v2;
CREATE TRIGGER trg_validate_team_activation_v2 BEFORE UPDATE OF status ON teams_v2 FOR EACH ROW EXECUTE FUNCTION validate_team_activation_v2();

CREATE TABLE IF NOT EXISTS projects_v2 (
  id BIGSERIAL PRIMARY KEY,
  pbl_cycle_id INT NOT NULL REFERENCES pbl_cycles_v2(id),
  project_code VARCHAR(60) UNIQUE NOT NULL,
  title VARCHAR(260) NOT NULL,
  short_description TEXT,
  description TEXT,
  problem_statement TEXT,
  expected_outcome TEXT,
  domain VARCHAR(120),
  technology_stack TEXT,
  difficulty VARCHAR(30),
  project_type VARCHAR(30) NOT NULL CHECK(project_type IN ('FACULTY_PROJECT','STUDENT_PROJECT')),
  owner_faculty_id INT REFERENCES faculty_v2(id),
  owner_team_id BIGINT REFERENCES teams_v2(id),
  guide_faculty_id INT REFERENCES faculty_v2(id),
  max_teams INT NOT NULL DEFAULT 1 CHECK(max_teams > 0),
  application_mode VARCHAR(20) NOT NULL CHECK(application_mode IN ('OPEN','RESERVED')),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CHECK (
    (project_type='FACULTY_PROJECT' AND owner_faculty_id IS NOT NULL AND owner_team_id IS NULL AND guide_faculty_id=owner_faculty_id AND application_mode='OPEN') OR
    (project_type='STUDENT_PROJECT' AND owner_team_id IS NOT NULL AND owner_faculty_id IS NULL AND application_mode='RESERVED')
  )
);

CREATE TABLE IF NOT EXISTS project_applications_v2 (
  id BIGSERIAL PRIMARY KEY,
  application_code VARCHAR(60) UNIQUE NOT NULL,
  team_id BIGINT NOT NULL REFERENCES teams_v2(id),
  project_id BIGINT NOT NULL REFERENCES projects_v2(id),
  submitted_by BIGINT REFERENCES users_v2(id),
  statement_of_interest TEXT,
  proposed_approach TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','UNDER_REVIEW','DISCUSSION','ACCEPTED','REJECTED','WITHDRAWN')),
  faculty_remarks TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  UNIQUE(team_id, project_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_application_per_team_v2 ON project_applications_v2(team_id) WHERE status IN ('SUBMITTED','UNDER_REVIEW','DISCUSSION','ACCEPTED');

CREATE OR REPLACE FUNCTION validate_faculty_project_application_v2() RETURNS TRIGGER AS $$
DECLARE p RECORD; t RECORD;
BEGIN
 SELECT project_type,application_mode,pbl_cycle_id,status INTO p FROM projects_v2 WHERE id=NEW.project_id;
 SELECT pbl_cycle_id,status INTO t FROM teams_v2 WHERE id=NEW.team_id;
 IF p.project_type <> 'FACULTY_PROJECT' OR p.application_mode <> 'OPEN' THEN RAISE EXCEPTION 'Teams can apply only to open faculty projects'; END IF;
 IF p.pbl_cycle_id <> t.pbl_cycle_id THEN RAISE EXCEPTION 'Team and project must belong to the same PBL cycle'; END IF;
 IF t.status IN ('PROJECT_ASSIGNED','LOCKED','COMPLETED') THEN RAISE EXCEPTION 'Team already has a project'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_validate_faculty_project_application_v2 ON project_applications_v2;
CREATE TRIGGER trg_validate_faculty_project_application_v2 BEFORE INSERT ON project_applications_v2 FOR EACH ROW EXECUTE FUNCTION validate_faculty_project_application_v2();

CREATE TABLE IF NOT EXISTS guide_requests_v2 (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects_v2(id),
  team_id BIGINT NOT NULL REFERENCES teams_v2(id),
  requested_faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','DISCUSSION','REVISION_REQUESTED','ACCEPTED','REJECTED','CANCELLED')),
  faculty_remarks TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_guide_request_per_project_v2 ON guide_requests_v2(project_id) WHERE status IN ('REQUESTED','DISCUSSION','REVISION_REQUESTED','ACCEPTED');

CREATE OR REPLACE FUNCTION validate_student_guide_request_v2() RETURNS TRIGGER AS $$
DECLARE p RECORD;
BEGIN
 SELECT project_type,owner_team_id INTO p FROM projects_v2 WHERE id=NEW.project_id;
 IF p.project_type <> 'STUDENT_PROJECT' OR p.owner_team_id <> NEW.team_id THEN RAISE EXCEPTION 'Only the owning team can request a guide for a student project'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_validate_student_guide_request_v2 ON guide_requests_v2;
CREATE TRIGGER trg_validate_student_guide_request_v2 BEFORE INSERT ON guide_requests_v2 FOR EACH ROW EXECUTE FUNCTION validate_student_guide_request_v2();

CREATE TABLE IF NOT EXISTS project_allocations_v2 (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects_v2(id),
  team_id BIGINT NOT NULL REFERENCES teams_v2(id),
  guide_faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  allocation_type VARCHAR(40) NOT NULL CHECK(allocation_type IN ('FACULTY_PROJECT_SELECTED','STUDENT_PROJECT_CONFIRMED')),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id),
  UNIQUE(project_id,team_id)
);

CREATE OR REPLACE FUNCTION validate_guide_capacity_v2() RETURNS TRIGGER AS $$
DECLARE cycle_id INT; sem_count INT; total_count INT; sem_limit INT; overall_limit INT;
BEGIN
 SELECT p.pbl_cycle_id INTO cycle_id FROM projects_v2 p WHERE p.id=NEW.project_id;
 SELECT COUNT(*) INTO sem_count FROM project_allocations_v2 pa JOIN projects_v2 p ON p.id=pa.project_id WHERE pa.guide_faculty_id=NEW.guide_faculty_id AND p.pbl_cycle_id=cycle_id AND pa.status='ACTIVE';
 SELECT COUNT(*) INTO total_count FROM project_allocations_v2 pa JOIN projects_v2 p ON p.id=pa.project_id JOIN pbl_cycles_v2 pc ON pc.id=p.pbl_cycle_id JOIN pbl_cycles_v2 target ON target.id=cycle_id WHERE pa.guide_faculty_id=NEW.guide_faculty_id AND pc.academic_cycle_id=target.academic_cycle_id AND pa.status='ACTIVE';
 SELECT max_projects INTO sem_limit FROM faculty_semester_guide_limits_v2 WHERE pbl_cycle_id=cycle_id AND faculty_id=NEW.guide_faculty_id;
 SELECT gl.overall_max_projects INTO overall_limit FROM faculty_guide_limits_v2 gl JOIN pbl_cycles_v2 pc ON pc.academic_cycle_id=gl.academic_cycle_id WHERE pc.id=cycle_id AND gl.faculty_id=NEW.guide_faculty_id;
 sem_limit:=COALESCE(sem_limit,3); overall_limit:=COALESCE(overall_limit,6);
 IF sem_count >= sem_limit THEN RAISE EXCEPTION 'Faculty semester guide capacity reached'; END IF;
 IF total_count >= overall_limit THEN RAISE EXCEPTION 'Faculty overall guide capacity reached'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_validate_guide_capacity_v2 ON project_allocations_v2;
CREATE TRIGGER trg_validate_guide_capacity_v2 BEFORE INSERT ON project_allocations_v2 FOR EACH ROW EXECUTE FUNCTION validate_guide_capacity_v2();

CREATE TABLE IF NOT EXISTS pbl_reviews_v2 (
  id SERIAL PRIMARY KEY,
  pbl_cycle_id INT NOT NULL REFERENCES pbl_cycles_v2(id),
  name VARCHAR(120) NOT NULL,
  sequence_no INT NOT NULL,
  subject_code VARCHAR(50),
  review_date DATE,
  submission_deadline TIMESTAMPTZ,
  maximum_marks NUMERIC(6,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT REFERENCES users_v2(id),
  UNIQUE(pbl_cycle_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS rubrics_v2 (
  id SERIAL PRIMARY KEY,
  review_id INT UNIQUE NOT NULL REFERENCES pbl_reviews_v2(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  total_marks NUMERIC(6,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT REFERENCES users_v2(id),
  published_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS rubric_items_v2 (
  id SERIAL PRIMARY KEY,
  rubric_id INT NOT NULL REFERENCES rubrics_v2(id) ON DELETE CASCADE,
  co_code VARCHAR(30),
  criterion_name VARCHAR(200) NOT NULL,
  criterion_description TEXT,
  max_marks NUMERIC(6,2) NOT NULL,
  display_order INT NOT NULL,
  UNIQUE(rubric_id, display_order)
);
CREATE TABLE IF NOT EXISTS rubric_levels_v2 (
  id SERIAL PRIMARY KEY,
  rubric_item_id INT NOT NULL REFERENCES rubric_items_v2(id) ON DELETE CASCADE,
  level_label VARCHAR(50) NOT NULL,
  marks NUMERIC(6,2) NOT NULL,
  descriptor TEXT NOT NULL,
  display_order INT NOT NULL,
  UNIQUE(rubric_item_id, display_order)
);
CREATE TABLE IF NOT EXISTS review_scores_v2 (
  id BIGSERIAL PRIMARY KEY,
  review_id INT NOT NULL REFERENCES pbl_reviews_v2(id),
  team_id BIGINT NOT NULL REFERENCES teams_v2(id),
  enrollment_id BIGINT NOT NULL REFERENCES student_enrollments_v2(id),
  rubric_item_id INT NOT NULL REFERENCES rubric_items_v2(id),
  selected_level_id INT REFERENCES rubric_levels_v2(id),
  marks_awarded NUMERIC(6,2) NOT NULL DEFAULT 0,
  zero_reason VARCHAR(100),
  evaluator_faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  remarks TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id,enrollment_id,rubric_item_id)
);

CREATE TABLE IF NOT EXISTS rubric_imports_v2 (
  id BIGSERIAL PRIMARY KEY,
  review_id INT REFERENCES pbl_reviews_v2(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  uploaded_by BIGINT REFERENCES users_v2(id),
  status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
  warnings JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_requests_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users_v2(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESET','CANCELLED')),
  resolved_by BIGINT REFERENCES users_v2(id),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS import_batches_v2 (
  id BIGSERIAL PRIMARY KEY,
  import_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  imported_by BIGINT REFERENCES users_v2(id),
  total_rows INT DEFAULT 0,
  success_rows INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users_v2(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_attempts_v2 (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  ip_address VARCHAR(100),
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_v2_user_time ON login_attempts_v2(username, attempted_at DESC);
