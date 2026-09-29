# Changelog — V4.1.0

- Preserves all Falcon PBL V4 academic and review-submission functionality.
- Replaces testing student seed data with the fresh 246-student production master.
- Preserves Semester and Section as enrollment-driving data.
- Normalizes Semester 7 CS3A/CS3B anomalies to CS4A/CS4B as approved.
- Adds `date_of_birth` and `mother_name` to `students_v2`.
- Implements student initial password rule `m + MMDD + first meaningful mother's name`.
- Skips single-letter initials (`S MEENAKSHI` -> `meenakshi`).
- Uses `india` when Mother is `NO DATA`.
- Marks accounts inactive when DOB is missing rather than inventing a password.
- Adds a guarded production reset script that preserves the faculty master while discarding V4 test workflow data and test PBL Coordinator assignments.
- Adds production credential and exception audit files.
- Adds Falcon Bakes credits for Varsha A and Nikhil G K and a public About page.
