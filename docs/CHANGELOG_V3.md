# V3 Change Log

## Functional changes

1. Faculty Applications Received now shows team name and full active team membership: name, USN, email, department/program, semester, section, and role.
2. A reusable Back button is rendered from the shared root layout, so present and future pages receive consistent back navigation.
3. Added navigation loading feedback and database indexes for high-frequency workflows.
4. Student Dashboard now links to a private **My Team** page rather than the public team directory.
5. Rubric evaluation is now performed once for the whole team.
6. Faculty enters one contribution indicator (%) per student; student CO-wise and total obtained marks are derived from the team rubric score.
7. Students can view the published blank rubric before evaluation and, after faculty submission, their team's evaluated rubric plus contribution indicators of all own-team members.
8. Added HoD Review Verification dashboard with analytics.
9. HoD can approve the entire review, return the entire review, or return selected students for contribution correction.
10. Faculty review becomes read-only while pending HoD verification or after verification.
11. Added workflow notifications and verification audit history.
12. Existing V2/V2.1 rows are retained; V3 schema is additive.

## Clarifications overriding the original student-test document

The current agreed requirement is that students **may see their own team's evaluated rubric and all own-team contribution indicators**. The original test document's statement that students never see evaluation results is superseded by this later clarification.

Faculty does **not** manually enter individual marks. Faculty enters contribution indicator percentages; the system derives individual marks.
