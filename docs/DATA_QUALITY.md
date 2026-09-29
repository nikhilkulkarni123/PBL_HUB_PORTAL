# Seed Data Quality Notes

Source files:

- Faculty master workbook supplied for the project.
- PBL student list workbook supplied for the project.

Loaded seed totals:

- 23 faculty profiles.
- 231 student profiles/enrollments.
- Semester 5: 147 students.
- Semester 7: 84 students.

Sections found in the supplied student list include CS3A, CS3B, CS3C, CS4A, CS4B and one source row carrying CS2C. V2 deliberately preserves source values. The HoD should verify the exceptional section value before production use.

Three mentor Employee IDs referenced by students were not present in the small Faculty Master contact sheet and were therefore created from mentor references so foreign keys remain valid: EC25085, EC25086 and EC25088. Their email/phone remain blank until updated by CSV.

Most supplied faculty and student records do not include verified email/phone. Password recovery therefore defaults to HoD-mediated resets.
