-- Falcon PBL Project Hub V3 additive migration.
-- IMPORTANT: no V2 tables or data are dropped/rewritten. Existing test data is retained.

CREATE TABLE IF NOT EXISTS review_evaluations_v3 (
  id BIGSERIAL PRIMARY KEY,
  review_id INT NOT NULL REFERENCES pbl_reviews_v2(id),
  team_id BIGINT NOT NULL REFERENCES teams_v2(id),
  guide_faculty_id INT NOT NULL REFERENCES faculty_v2(id),
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','PENDING_HOD_VERIFICATION','RETURNED_FOR_CORRECTION','VERIFIED')),
  faculty_remarks TEXT,
  faculty_declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  hod_user_id BIGINT REFERENCES users_v2(id),
  hod_comments TEXT,
  return_scope VARCHAR(20) CHECK(return_scope IN ('ENTIRE','STUDENTS')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, team_id)
);

CREATE TABLE IF NOT EXISTS team_rubric_scores_v3 (
  id BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT NOT NULL REFERENCES review_evaluations_v3(id) ON DELETE CASCADE,
  rubric_item_id INT NOT NULL REFERENCES rubric_items_v2(id),
  selected_level_id INT NOT NULL REFERENCES rubric_levels_v2(id),
  marks_awarded NUMERIC(7,2) NOT NULL,
  UNIQUE(evaluation_id, rubric_item_id)
);

CREATE TABLE IF NOT EXISTS student_contributions_v3 (
  id BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT NOT NULL REFERENCES review_evaluations_v3(id) ON DELETE CASCADE,
  enrollment_id BIGINT NOT NULL REFERENCES student_enrollments_v2(id),
  contribution_percent NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK(contribution_percent BETWEEN 0 AND 100),
  correction_status VARCHAR(30) NOT NULL DEFAULT 'OK' CHECK(correction_status IN ('OK','RETURNED')),
  hod_comment TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(evaluation_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS review_verification_actions_v3 (
  id BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT NOT NULL REFERENCES review_evaluations_v3(id) ON DELETE CASCADE,
  hod_user_id BIGINT NOT NULL REFERENCES users_v2(id),
  action VARCHAR(40) NOT NULL CHECK(action IN ('APPROVE','RETURN_ENTIRE_REVIEW','RETURN_STUDENTS')),
  comments TEXT,
  selected_enrollment_ids BIGINT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications_v3 (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users_v2(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(300),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for the tested workflows.
CREATE INDEX IF NOT EXISTS idx_team_members_v2_team_active ON team_members_v2(team_id,status);
CREATE INDEX IF NOT EXISTS idx_project_apps_v2_owner_review ON project_applications_v2(project_id,status,applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_v2_owner ON projects_v2(owner_faculty_id,status);
CREATE INDEX IF NOT EXISTS idx_allocations_v2_guide ON project_allocations_v2(guide_faculty_id,status);
CREATE INDEX IF NOT EXISTS idx_enrollments_v2_student ON student_enrollments_v2(student_id,academic_cycle_id,semester);
CREATE INDEX IF NOT EXISTS idx_review_eval_v3_status ON review_evaluations_v3(status,submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_eval_v3_guide ON review_evaluations_v3(guide_faculty_id,status);
CREATE INDEX IF NOT EXISTS idx_notifications_v3_user ON notifications_v3(user_id,is_read,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_v2_lower_username ON users_v2((lower(username))) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_roles_v2_code ON roles_v2(code);
