import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const teamId = Number(id);
  if (!teamId || isNaN(teamId)) {
    return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
  }

  const body = await req.json();
  const teamName = String(body.teamName || '').trim();
  const rawEnrollmentIds: number[] = Array.isArray(body.enrollmentIds)
    ? body.enrollmentIds.map(Number).filter((n: number) => !isNaN(n))
    : [];
  const enrollmentIds = Array.from(new Set(rawEnrollmentIds));
  const rawLeaderId = Number(body.leaderEnrollmentId);
  const leaderEnrollmentId = enrollmentIds.includes(rawLeaderId) ? rawLeaderId : enrollmentIds[0];

  const guideFacultyIdRaw = Number(body.guideFacultyId);
  const guideFacultyId = !isNaN(guideFacultyIdRaw) && guideFacultyIdRaw > 0 ? guideFacultyIdRaw : null;
  const projectTitle = String(body.projectTitle || '').trim();

  if (!teamName) {
    return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current team and cycle info
    const teamRes = await client.query(
      `SELECT t.*, pc.academic_cycle_id, pc.program_id, pc.semester, pc.team_min_size, pc.team_max_size, pc.coordinator_assignment_id,
              pr.code program_code, ac.name cycle_name
       FROM teams_v2 t
       JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
       JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id
       JOIN programs_v2 pr ON pr.id = pc.program_id
       WHERE t.id = $1 FOR UPDATE`,
      [teamId]
    );

    if (teamRes.rowCount === 0) {
      throw new Error('Team not found');
    }

    const team = teamRes.rows[0];

    // Authorization check for coordinator
    if (!u.roles.includes('HOD')) {
      const allowed = (
        await client.query(
          `SELECT 1 FROM pbl_coordinator_assignments_v2 
           WHERE id = $1 AND faculty_id = $2 AND is_active`,
          [team.coordinator_assignment_id, u.facultyId]
        )
      ).rowCount;

      if (!allowed) {
        throw new Error('You are not authorized to manage teams for this semester.');
      }
    }

    const minSize = Number(team.team_min_size) || 3;
    const maxSize = Number(team.team_max_size) || 6;

    if (enrollmentIds.length < minSize || enrollmentIds.length > maxSize) {
      throw new Error(`Team must have between ${minSize} and ${maxSize} students. (Selected: ${enrollmentIds.length})`);
    }

    if (!leaderEnrollmentId || !enrollmentIds.includes(leaderEnrollmentId)) {
      throw new Error('A valid team leader must be chosen from the member list.');
    }

    // Verify all enrollments belong to the correct academic cycle, program, and semester
    const enrollmentsCheck = await client.query(
      `SELECT e.id, s.name, s.usn
       FROM student_enrollments_v2 e
       JOIN students_v2 s ON s.id = e.student_id
       WHERE e.id = ANY($1::bigint[])
         AND e.academic_cycle_id = $2
         AND e.program_id = $3
         AND e.semester = $4`,
      [enrollmentIds, team.academic_cycle_id, team.program_id, team.semester]
    );

    if (enrollmentsCheck.rowCount !== enrollmentIds.length) {
      throw new Error('One or more selected students do not belong to this cycle/semester/program.');
    }

    // Verify none of the added students belong to another team in this PBL cycle
    const otherTeamMembers = await client.query(
      `SELECT tm.enrollment_id, s.name, s.usn, t.team_name, t.team_code
       FROM team_members_v2 tm
       JOIN teams_v2 t ON t.id = tm.team_id
       JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
       JOIN students_v2 s ON s.id = e.student_id
       WHERE tm.pbl_cycle_id = $1
         AND tm.team_id <> $2
         AND tm.enrollment_id = ANY($3::bigint[])`,
      [team.pbl_cycle_id, teamId, enrollmentIds]
    );

    if (otherTeamMembers.rowCount && otherTeamMembers.rowCount > 0) {
      const busy = otherTeamMembers.rows.map((r: any) => `${r.name} (${r.usn}) in ${r.team_name}`).join(', ');
      throw new Error(`Cannot add student(s) already assigned to another team: ${busy}`);
    }

    // 1. Update team details
    await client.query(
      `UPDATE teams_v2 
       SET team_name = $1, 
           leader_enrollment_id = $2
       WHERE id = $3`,
      [teamName, leaderEnrollmentId, teamId]
    );

    // 2. Remove members no longer in the list
    await client.query(
      `DELETE FROM team_members_v2 
       WHERE team_id = $1 
         AND enrollment_id <> ALL($2::bigint[])`,
      [teamId, enrollmentIds]
    );

    // 3. Upsert existing/new members with correct role
    for (const eid of enrollmentIds) {
      const role = eid === leaderEnrollmentId ? 'LEADER' : 'MEMBER';
      await client.query(
        `INSERT INTO team_members_v2 (team_id, enrollment_id, pbl_cycle_id, member_role, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (team_id, enrollment_id)
         DO UPDATE SET member_role = $4, status = 'ACTIVE'`,
        [teamId, eid, team.pbl_cycle_id, role]
      );
    }

    // 4. Handle Guide & Project Allocation
    const existingAllocation = (
      await client.query(
        `SELECT pa.*, p.id project_id 
         FROM project_allocations_v2 pa 
         JOIN projects_v2 p ON p.id = pa.project_id 
         WHERE pa.team_id = $1 AND pa.status = 'ACTIVE'`,
        [teamId]
      )
    ).rows[0];

    if (guideFacultyId) {
      if (existingAllocation) {
        // Update existing allocation
        await client.query(
          `UPDATE project_allocations_v2 SET guide_faculty_id = $1 WHERE id = $2`,
          [guideFacultyId, existingAllocation.id]
        );
        await client.query(
          `UPDATE projects_v2 SET guide_faculty_id = $1, title = COALESCE(NULLIF($2, ''), title) WHERE id = $3`,
          [guideFacultyId, projectTitle, existingAllocation.project_id]
        );
      } else {
        // Create new project and allocation for this team
        const progTag = team.program_code?.includes('GMIT') ? 'GMIT' : 'GMU';
        const finalTitle = projectTitle || `${teamName} - Project`;
        const projPrefix = `PBL-SP-${progTag}-${team.pbl_cycle_id}-`;
        const allExistingProjCodes = (
          await client.query(`SELECT project_code FROM projects_v2`)
        ).rows.map((r: any) => r.project_code);

        let pseq = 1;
        let projectCode = `${projPrefix}${String(pseq).padStart(4, '0')}`;
        while (allExistingProjCodes.includes(projectCode)) {
          pseq++;
          projectCode = `${projPrefix}${String(pseq).padStart(4, '0')}`;
        }

        const proj = (
          await client.query(
            `INSERT INTO projects_v2(
               pbl_cycle_id, project_code, title, short_description, description,
               problem_statement, expected_outcome, domain, technology_stack,
               project_type, owner_team_id, guide_faculty_id, max_teams,
               application_mode, status, published_at
             ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, 'STUDENT_PROJECT', $10, $11, 1, 'RESERVED', 'IN_PROGRESS', NOW())
             RETURNING id`,
            [
              team.pbl_cycle_id,
              projectCode,
              finalTitle,
              `Project allocated to team ${teamName}`,
              `Project allocated to team ${teamName}`,
              `Project problem statement for team ${teamName}`,
              `Expected outcome for team ${teamName}`,
              'General',
              'Full Stack',
              teamId,
              guideFacultyId,
            ]
          )
        ).rows[0];

        await client.query(
          `INSERT INTO project_allocations_v2(project_id, team_id, guide_faculty_id, allocation_type, status)
           VALUES($1, $2, $3, 'STUDENT_PROJECT_CONFIRMED', 'ACTIVE')`,
          [proj.id, teamId, guideFacultyId]
        );
      }
      await client.query(`UPDATE teams_v2 SET status = 'PROJECT_ASSIGNED' WHERE id = $1`, [teamId]);
    } else {
      // Guide removed/unassigned
      if (existingAllocation) {
        await client.query(`DELETE FROM project_allocations_v2 WHERE id = $1`, [existingAllocation.id]);
        await client.query(`UPDATE teams_v2 SET status = 'ACTIVE' WHERE id = $1`, [teamId]);
      }
    }

    // 5. Audit Log
    await client.query(
      `INSERT INTO audit_logs_v2(user_id, action, entity_type, entity_id, details)
       VALUES($1, 'TEAM_UPDATED', 'TEAM', $2, $3)`,
      [
        u.id,
        teamId,
        JSON.stringify({
          team_code: team.team_code,
          team_name: teamName,
          members_count: enrollmentIds.length,
          leader_enrollment_id: leaderEnrollmentId,
          guide_faculty_id: guideFacultyId,
        }),
      ]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Team updated successfully.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update team.' },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const teamId = Number(id);
  if (!teamId || isNaN(teamId)) {
    return NextResponse.json({ error: 'Invalid team ID' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const teamRes = await client.query(
      `SELECT t.*, pc.coordinator_assignment_id
       FROM teams_v2 t
       JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
       WHERE t.id = $1 FOR UPDATE`,
      [teamId]
    );

    if (teamRes.rowCount === 0) {
      throw new Error('Team not found');
    }

    const team = teamRes.rows[0];

    // Authorization check
    if (!u.roles.includes('HOD')) {
      const allowed = (
        await client.query(
          `SELECT 1 FROM pbl_coordinator_assignments_v2 
           WHERE id = $1 AND faculty_id = $2 AND is_active`,
          [team.coordinator_assignment_id, u.facultyId]
        )
      ).rowCount;

      if (!allowed) {
        throw new Error('You are not authorized to delete teams for this semester.');
      }
    }

    // Clean up any project allocations or requests associated with this team
    await client.query(`DELETE FROM project_allocations_v2 WHERE team_id = $1`, [teamId]);
    await client.query(`DELETE FROM project_applications_v2 WHERE team_id = $1`, [teamId]);

    // Delete team (team_members_v2 cascades via foreign key)
    await client.query(`DELETE FROM teams_v2 WHERE id = $1`, [teamId]);

    await client.query(
      `INSERT INTO audit_logs_v2(user_id, action, entity_type, entity_id, details)
       VALUES($1, 'TEAM_DELETED', 'TEAM', $2, $3)`,
      [
        u.id,
        teamId,
        JSON.stringify({
          team_code: team.team_code,
          team_name: team.team_name,
        }),
      ]
    );

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Team deleted successfully.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete team.' },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}
