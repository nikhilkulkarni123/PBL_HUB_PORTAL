# Testing Strategy — V2

Required tests:
1. HoD can assign exactly one active coordinator per semester.
2. Student cannot join two teams in one PBL cycle.
3. Cross-semester team membership is rejected by the database.
4. Team activation fails outside configured min/max size.
5. Faculty project records the same faculty as owner and guide.
6. Student project is reserved to its owning team.
7. Only owning team can request a guide for a student project.
8. Team can have only one active faculty-project application.
9. Accepted allocation checks semester and overall guide limits.
10. Rejection requires remarks.
11. Rubric designer supports variable criteria and levels.
12. Rubric cannot publish if totals mismatch.
13. Guide can evaluate only their allocated teams.
14. Zero-mark reason produces zero without selecting a performance level.
15. Temporary password forces first-login change.
16. Five failed logins in 15 minutes temporarily throttle the username.
17. Forgot password creates a HoD-visible reset request.
18. CSV update does not change an existing password.
19. Public pages expose no phone, email or credentials.
