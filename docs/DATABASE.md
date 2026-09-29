# Database Design — V2

The authoritative schema is `db/migrations/001_core.sql`.

## Identity and roles
`users_v2`, `roles_v2`, `user_roles_v2`, `faculty_v2`, `students_v2`.

HoD and PBL Coordinator are roles assigned to faculty users. Students have the STUDENT role.

## Academic structure
`academic_cycles_v2`, `programs_v2`, `sections_v2`, `student_enrollments_v2`, `pbl_cycles_v2`, `pbl_coordinator_assignments_v2`.

There is one active coordinator per semester/program/academic cycle.

## Team integrity
`teams_v2`, `team_members_v2`.

Membership references the student's enrollment for the academic cycle. A unique constraint on `(enrollment_id, pbl_cycle_id)` prevents one student joining two teams in the same PBL cycle. A database trigger rejects semester/program/cycle mismatches. Team activation checks coordinator-configured min/max team size and leader membership.

## Projects
`projects_v2`, `project_applications_v2`, `guide_requests_v2`, `project_allocations_v2`.

Faculty project: faculty owner = guide, application mode OPEN.
Student project: team owner, application mode RESERVED; only owner team can request a guide.

## Guide capacity
`faculty_guide_limits_v2` stores overall academic-cycle capacity. `faculty_semester_guide_limits_v2` stores semester capacity. Allocation trigger checks both.

## Reviews and rubrics
`pbl_reviews_v2`, `rubrics_v2`, `rubric_items_v2`, `rubric_levels_v2`, `review_scores_v2`, `rubric_imports_v2`.

Each rubric item has independent performance-level descriptors and marks. Review scores are student-wise and retain the selected level. Zero-mark exceptions are stored separately.

## Security and operations
`password_reset_requests_v2`, `login_attempts_v2`, `import_batches_v2`, `audit_logs_v2`.
