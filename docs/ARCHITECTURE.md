# Architecture — V2

Next.js App Router provides public and protected interfaces. Route handlers implement business actions. PostgreSQL is the source of truth and also enforces critical academic integrity rules through unique indexes, checks and triggers.

Authentication uses bcrypt password hashes and signed HTTP-only session cookies. Authorization uses multi-role assignments: HOD, PBL_COORDINATOR, FACULTY, STUDENT.

The application is provider-neutral: Vercel, Render or a university Node.js server can use the same codebase and any standard PostgreSQL provider.

Public modules expose only project/team/faculty/allocation information. Protected modules contain personal contact data, master imports, credentials, decisions, rubric design and evaluation.
