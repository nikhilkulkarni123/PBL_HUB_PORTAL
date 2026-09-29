# Maintenance Handbook

## Ownership

Assign named owners for application code, database, infrastructure, master-data quality and academic-process configuration. Avoid a single-person dependency.

## Routine schedule

### Daily
- Check application and database availability.
- Review failed login spikes and server errors.
- Review pending database storage alerts.

### Weekly
- Confirm backups completed and perform a sample restore verification.
- Review audit logs for unusual allocation changes.
- Check unhandled applications and incomplete teams.

### Each academic cycle
- Create the new academic cycle.
- Import and validate Faculty Master and Student Master.
- Configure supervisor assignments.
- Test team and allocation workflows with a small pilot group.
- Archive or freeze the earlier cycle.

## Safe code update

1. Create a Git branch.
2. Document the requested change and acceptance criteria.
3. Add/update tests.
4. Test using a staging database.
5. Back up production.
6. Apply migrations before dependent application code.
7. Deploy.
8. Run the smoke-test checklist.
9. Tag the release.

## Backup policy

- Daily automated database backups.
- At least one weekly off-server backup.
- Retain monthly snapshots for the institutional retention period.
- Test restoration at least once per term.

## Incident response

1. Preserve logs and note exact time.
2. Disable only the affected action where possible; keep public reading available.
3. Restore from backup only after identifying the failure boundary.
4. Record affected teams/projects and reconcile allocations.
5. Publish an internal incident note and preventive action.

## Password and secret rotation

Never commit `.env`. Rotate `SESSION_SECRET`, database credentials and infrastructure tokens when a maintainer leaves or a secret may have leaked.
