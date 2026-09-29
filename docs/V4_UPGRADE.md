# Falcon PBL Project Hub V4 — Database-Preserving Upgrade

V4 is an additive upgrade over the student-tested V3 baseline. It does **not** drop, truncate, reseed, or recreate V2/V3 tables.

## What V4 adds

- Review-specific dynamic submission requirements configured by the PBL Coordinator.
- Team-based student review submission with file/link validation.
- Default file-size UX of 1 MB; coordinator-configurable up to a 1 MB per-file ceiling.
- No video file upload. Demonstration videos are supplied as YouTube links.
- Faculty evaluation lock until required team evidence is submitted.
- Faculty Review Files view.
- Student Review Submissions dashboard/module.
- Final HoD-verified two-page PDF rubric sheet for offline signatures.
- Student signature column, Project Guide signature area, HoD signature area.
- PDF download audit trail.

## Database migration

The new migration is `db/migrations/003_v4_review_submissions.sql`. It creates only new V4 tables and indexes:

- `review_file_requirements_v4`
- `team_review_submissions_v4`
- `team_review_submission_items_v4`
- `rubric_pdf_access_log_v4`

Existing V3 tables such as `review_evaluations_v3`, `team_rubric_scores_v3`, `student_contributions_v3`, and all V2 master/team/project data are retained unchanged.

## Upgrade an existing V3 test database

1. Back up the PostgreSQL database.
2. Deploy the V4 source over a new application release directory.
3. Keep the same `DATABASE_URL` and `SESSION_SECRET`.
4. Install dependencies: `npm install`.
5. Run `npm run db:upgrade-v4`.
6. Run `npm run build`.
7. Start/redeploy the application.

**Do not run `npm run db:seed` or `npm run db:setup` on the existing test database.** Those commands are intended for new environments.

## File storage model

Because normal review submissions are expected to be only one or two files, usually around 1 MB each, V4 stores the submitted binary file in PostgreSQL `BYTEA`. This keeps V4 portable between Render/Vercel-style deployments and a future GMU Linux server without introducing a separate object-storage dependency. Executable/dangerous extensions are blocked.

## Backward compatibility

Published V3 reviews with no V4 file requirements continue to work exactly as before: faculty evaluation remains unlocked and no team upload is required.
