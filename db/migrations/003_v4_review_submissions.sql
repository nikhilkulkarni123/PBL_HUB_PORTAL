-- Falcon PBL Project Hub V4 additive migration.
-- Retains all V2/V3 data and adds review deliverable submission + verified rubric PDF support.

ALTER TABLE pbl_reviews_v2 ADD COLUMN IF NOT EXISTS submission_open_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS review_file_requirements_v4 (
  id BIGSERIAL PRIMARY KEY,
  review_id INT NOT NULL REFERENCES pbl_reviews_v2(id) ON DELETE CASCADE,
  requirement_type VARCHAR(30) NOT NULL CHECK(requirement_type IN ('PDF','PPT','DOC','ZIP','IMAGE','CSV','EXCEL','URL','SOURCE_CODE','OTHER')),
  title VARCHAR(180) NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  max_size_bytes BIGINT NOT NULL DEFAULT 1048576 CHECK(max_size_bytes > 0 AND max_size_bytes <= 1048576),
  allowed_extensions TEXT[] NOT NULL DEFAULT '{}',
  max_files INT NOT NULL DEFAULT 1 CHECK(max_files BETWEEN 1 AND 10),
  instructions TEXT,
  url_kind VARCHAR(20) CHECK(url_kind IN ('ANY','YOUTUBE')),
  custom_type VARCHAR(120),
  display_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, display_order)
);

CREATE TABLE IF NOT EXISTS team_review_submissions_v4 (
  id BIGSERIAL PRIMARY KEY,
  review_id INT NOT NULL REFERENCES pbl_reviews_v2(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES teams_v2(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED')),
  validation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by_user_id BIGINT REFERENCES users_v2(id),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, team_id)
);

CREATE TABLE IF NOT EXISTS team_review_submission_items_v4 (
  id BIGSERIAL PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES team_review_submissions_v4(id) ON DELETE CASCADE,
  requirement_id BIGINT NOT NULL REFERENCES review_file_requirements_v4(id) ON DELETE CASCADE,
  original_filename VARCHAR(255),
  content_type VARCHAR(160),
  size_bytes BIGINT,
  file_data BYTEA,
  url_value TEXT,
  uploaded_by_user_id BIGINT REFERENCES users_v2(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((file_data IS NOT NULL AND url_value IS NULL) OR (file_data IS NULL AND url_value IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS rubric_pdf_access_log_v4 (
  id BIGSERIAL PRIMARY KEY,
  evaluation_id BIGINT NOT NULL REFERENCES review_evaluations_v3(id) ON DELETE CASCADE,
  downloaded_by_user_id BIGINT REFERENCES users_v2(id),
  verification_code VARCHAR(120) NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_file_req_v4_review ON review_file_requirements_v4(review_id,display_order);
CREATE INDEX IF NOT EXISTS idx_review_submission_v4_review_team ON team_review_submissions_v4(review_id,team_id,status);
CREATE INDEX IF NOT EXISTS idx_review_submission_items_v4_submission ON team_review_submission_items_v4(submission_id,requirement_id);
CREATE INDEX IF NOT EXISTS idx_rubric_pdf_access_v4_eval ON rubric_pdf_access_log_v4(evaluation_id,downloaded_at DESC);
