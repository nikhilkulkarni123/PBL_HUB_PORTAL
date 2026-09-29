# Password and Account Recovery — GMU V4.1.1

## Student initial login

Student username is the USN. The approved initial password rule is:

`m + MMDD + first meaningful mother's name (lowercase)`

Leading one-letter initials are skipped. Examples: `BHARATHI B` -> `bharathi`; `S MEENAKSHI` -> `meenakshi`; `NO DATA` -> `india`.

Students with a valid DOB are created with `must_change_password=true` and must choose a private password after first login. The password is stored only as a bcrypt hash in PostgreSQL. Students whose DOB is missing cannot receive an MMDD-based initial password and remain inactive until DOB is supplied.

## Faculty / HoD temporary passwords

New faculty/HoD accounts created by the seed/import workflow use generated temporary passwords and `must_change_password=true`. V4.1.1 does not change existing faculty passwords.

## Existing passwords during upgrade

The V4.1 -> V4.1.1 migration and faculty-project cleanup do not update or reset `users_v2.password_hash`, `must_change_password`, or student/faculty account identity fields.

## Recovery

Forgot-password requests remain HoD-mediated. A reset creates a new temporary password and records the existing audit workflow; it does not change the student-master password-generation rule used for initial onboarding.
