# Deployment Guide — V2

Environment variables: `DATABASE_URL`, `SESSION_SECRET`, and optionally `INITIAL_PASSWORD_MODE`.

Initial installation:
```bash
npm install
npm run db:setup
npm run build
npm start
```

`db:setup` applies `db/migrations/001_core.sql` and loads the supplied institutional seed. It creates `initial_credentials.csv` locally; protect this file and do not commit it.

## Vercel
Use an external PostgreSQL service. Set environment variables in Vercel, run database setup from a trusted administration machine, then deploy. Do not seed on every deployment.

## Render
Use the included `render.yaml` or an existing PostgreSQL instance. Run database setup once against the Render `DATABASE_URL`, then deploy the Docker web service.

## University server
Use Docker Compose or Node.js behind Nginx/Apache. Use HTTPS, firewall PostgreSQL, and schedule database backups.
