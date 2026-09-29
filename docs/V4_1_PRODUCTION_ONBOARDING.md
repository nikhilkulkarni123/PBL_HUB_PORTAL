# Falcon PBL Project Hub V4.1 — Production Student Onboarding

> **Historical onboarding document:** this describes the original V4.1 testing-to-production reset. For an existing V4.1 database with current data, use `V4_1_1_UPGRADE.md` and do not run the destructive production reset.


V4.1 keeps all V4 application functionality and replaces the V4 testing student/workflow data with the fresh production student master supplied in `source-data/PBL_Hub_Production_Students.xlsx`.

## Fresh student master

- Total students: 246
- Semester 5: 159
- Semester 7: 87
- Semester 5 sections: CS3A / CS3B / CS3C
- Semester 7 sections: CS4A / CS4B
- Four Semester-7 source rows marked CS3A/CS3B are normalized by the approved rule to CS4A/CS4B.

## Initial student password rule

Username: student USN, case-insensitive.

Initial password:

`m + MMDD + first meaningful mother's name (lowercase)`

Examples:

- `BHARATHI B` -> `bharathi`
- `USHA NARESH` -> `usha`
- `SHOBHA C PATIL` -> `shobha`
- `S MEENAKSHI` -> `meenakshi` (single-letter initials are skipped)
- `NO DATA` -> `india`

Students must change the temporary password after first login.

## Missing DOB handling

18 source rows contain `#N/A` for DOB. V4.1 imports and enrolls those students, but their login accounts are inactive because the approved password rule requires MMDD. They appear in `seed-data/production_student_exceptions_v4_1.csv`. After DOB is supplied, rerun/update the account through the HoD import/reset workflow.

## Testing-data reset

The V4 testing data is intentionally disposable. V4.1 retains the faculty master and HoD identity, while clearing testing:

- students and student logins
- teams and memberships
- test projects/applications/allocations
- review/rubric/evaluation/submission records
- contribution indicators and verification records
- test PBL Coordinator assignments
- test guide-capacity assignments (recreated as defaults)

The reset is guarded by `CONFIRM_PRODUCTION_RESET=YES`.

## Existing V4 testing database -> V4.1 production baseline

```bash
npm install
npm run db:upgrade-v4.1
CONFIRM_PRODUCTION_RESET=YES npm run db:prepare-production-v4.1
npm run build
npm start
```

On Windows PowerShell:

```powershell
npm install
npm run db:upgrade-v4.1
$env:CONFIRM_PRODUCTION_RESET="YES"
npm run db:prepare-production-v4.1
npm run build
npm start
```

Do not run the reset against a database containing real academic records.

## Verification files

- `seed-data/initial_student_credentials_v4_1.csv`
- `seed-data/production_student_exceptions_v4_1.csv`
- `seed-data/production_students_v4_1.json`
