# Falcon PBL Project Hub V4.0.0

## Review submission workflow
- Added Student Dashboard **Review Submissions** card.
- One submission per team; submission state is immediately shared across team members.
- Dynamic review requirements: PDF, PPT, DOC, ZIP, Image, CSV, Excel, URL, Source Code and Other.
- Video binary upload intentionally omitted; YouTube links are supported through URL requirements.
- Required/optional, allowed extensions, per-file max size, max file count, instructions and ordering are configurable.
- Per-file size is coordinator-configurable up to 1 MB, matching the intended lightweight review workflow.
- Requirements can be edited while a review is Draft and are locked after publishing.

## Evaluation gate
- Faculty sees Not Submitted / Submitted before evaluation.
- Required evidence must be submitted before the team rubric evaluation route and submit API are unlocked.
- Reviews with no configured V4 requirements remain compatible with V3 behavior.
- Faculty can open submitted files/links through **Review Files**.

## Existing V3 evaluation retained
- Faculty evaluates team rubric exactly once.
- Faculty enters a Contribution Indicator for each student.
- Student CO-wise and total marks are system-derived from team marks × contribution percentage.
- Existing HoD verification/return workflow is retained.

## Verified offline rubric PDF
- Available only after HoD verification.
- Two A4 pages in university-style assessment format.
- Page 1: project/team metadata, complete evaluated rubric, selected levels, obtained team marks.
- Page 2: Student Name, USN, Contribution Indicator, CO-wise derived marks, Total Marks, and blank Student Signature column.
- Physical signature areas for Project Guide and HoD.
- Verification ID and PDF access audit entry.
