# Falcon PBL Project Hub V4.1.1 — GMU Version

Falcon PBL Project Hub is the GM University, Davanagere Department of CSE PBL portal. V4.1.1 is a **minor corrective update** to the V4.1 GMU baseline. All academic workflows, student/faculty master data and the student password system remain unchanged except for the explicitly approved fixes below.

## V4.1.1 approved fixes

1. **Review dates** — new reviews use only `Submission Start Date` and `Submission Last Date`; no separate Review Date or time selector is shown.
2. **Review submission** — fixes the PostgreSQL parameter-type error that prevented team review submission. PDF/PPT/DOC/ZIP/image/CSV/Excel/source-code/other configured files work as before, and URL requirements accept valid HTTP/HTTPS links including YouTube, Google Drive, Google Docs and GitHub. A YouTube-only requirement remains YouTube-only.
3. **Team creation** — structured student table with search by USN/name, section filter, selected-student summary and leader selection. New/current cycle rule is minimum **4**, maximum **6** students.
4. **Faculty project publishing** — detailed/long project text is stored safely; `short_description` is upgraded to PostgreSQL `TEXT`, while title/domain validation returns a readable message instead of a raw HTTP 500.

## Data that stays unchanged

- **246 GMU students** and their academic enrollments/semester/section/mentor data.
- **23 faculty** in the GMU faculty master.
- Student username/password rule and existing password hashes.
- Team IDs, team membership and student-created projects.
- Review/rubric/contribution/HoD-verification functionality and existing review records.
- All other V4/V4.1 features and role behavior.

The student first-login rule remains: username = USN and initial password = `m + MMDD + first meaningful mother's name`, lowercase. Leading single-letter initials are skipped (`S MEENAKSHI` -> `meenakshi`), and `NO DATA` uses `india`. First login still forces a private password change. The 18 source students without DOB remain `DOB REQUIRED` until DOB is supplied.

## Requested one-time faculty-project cleanup

V4.1.1 includes a guarded cleanup command that removes **faculty-published projects**, their faculty-project applications and allocations, while keeping the affected teams and returning allocated teams to `ACTIVE`. It does **not** delete students, faculty, team membership, passwords, student-created projects or review data.

For an existing V4.1 database, run the cleanup **before** the team-size migration so older valid teams can be unallocated without changing their membership:

```bash
npm ci
CONFIRM_FACULTY_PROJECT_CLEANUP=YES npm run db:cleanup-faculty-projects-v4.1.1
npm run db:upgrade-v4.1.1
npm run build
npm start
```

PowerShell:

```powershell
npm ci
$env:CONFIRM_FACULTY_PROJECT_CLEANUP="YES"
npm run db:cleanup-faculty-projects-v4.1.1
npm run db:upgrade-v4.1.1
npm run build
npm start
```

**Do not run `db:prepare-production-v4.1` on the current production/live database.** That older command is the historical testing-data reset used when V4.1 was first prepared.

## New empty database

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

The bundled production seed retains the approved GMU master: 23 faculty and 246 students, with team defaults 4–6.

## Documentation

- `docs/V4_1_1_UPGRADE.md`
- `docs/CHANGELOG_V4_1_1.md`
- `docs/V4_1_PRODUCTION_ONBOARDING.md`
- `docs/V4_UPGRADE.md`
- `docs/DATABASE.md`
- `docs/DEPLOYMENT.md`
- `docs/PASSWORDS.md`
- `docs/RUBRIC_ENGINE.md`
