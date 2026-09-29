# Falcon PBL Project Hub — V3 Upgrade

V3 is designed as an **additive upgrade** over an already-tested V2/V2.1 PostgreSQL database.

## Preserve the testing database

1. Take a PostgreSQL backup before upgrade.
2. Keep the existing `DATABASE_URL` unchanged.
3. Deploy the V3 application code.
4. Run **only**:

```bash
npm run db:upgrade-v3
```

Do **not** run `npm run db:seed` or `npm run db:setup` against the existing test database. Seeding is for a new database only.

The migration `db/migrations/002_v3_review_workflow.sql` creates new V3 review-workflow tables and indexes. It does not drop, truncate, rename, or rewrite existing V2 tables, teams, projects, applications, users, allocations, passwords, imports, or test records.

## V3 review model

V2's `review_scores_v2` is retained as legacy test history. V3 uses new tables:

- `review_evaluations_v3` — one review record per team/review.
- `team_rubric_scores_v3` — one selected rubric level per criterion for the whole team.
- `student_contributions_v3` — contribution indicator (%) for each team member.
- `review_verification_actions_v3` — HoD approval/return history.
- `notifications_v3` — workflow notifications.

Individual derived marks are calculated as:

`student obtained mark = team obtained mark × contribution indicator / 100`

The original CO/review maximum mark remains unchanged.

## Review state workflow

`DRAFT → PENDING_HOD_VERIFICATION → VERIFIED`

or

`DRAFT → PENDING_HOD_VERIFICATION → RETURNED_FOR_CORRECTION → PENDING_HOD_VERIFICATION`

HoD may return the entire review or only selected students' contribution indicators.

## Student visibility

- Before faculty submission: published blank rubric only.
- After faculty submission: the team's selected rubric levels and team members' contribution indicators are visible to members of that team.
- Students cannot edit evaluation data.

## Regression checks

After migration, verify that existing V2.1 data counts have not changed:

```sql
SELECT COUNT(*) FROM users_v2;
SELECT COUNT(*) FROM students_v2;
SELECT COUNT(*) FROM faculty_v2;
SELECT COUNT(*) FROM teams_v2;
SELECT COUNT(*) FROM projects_v2;
SELECT COUNT(*) FROM project_applications_v2;
SELECT COUNT(*) FROM project_allocations_v2;
```

Record these counts before and after migration. They should be identical.
