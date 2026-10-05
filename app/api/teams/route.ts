import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) return NextResponse.redirect(new URL('/login', req.url), 303);

  const f = await req.formData();
  const pblCycleId = Number(f.get('pblCycleId'));
  const ids = f.getAll('enrollmentIds').map(Number).filter((n) => !isNaN(n) && n > 0);
  const leaderRaw = Number(f.get('leaderEnrollmentId'));
  const leader = ids.includes(leaderRaw) ? leaderRaw : ids[0];
  const name = String(f.get('teamName') || '').trim();
  const guideFacultyIdRaw = Number(f.get('guideFacultyId'));
  const guideFacultyId = !isNaN(guideFacultyIdRaw) && guideFacultyIdRaw > 0 ? guideFacultyIdRaw : null;
  const rawProjectTitle = String(f.get('projectTitle') || '').trim();

  if (!name || !ids.length || !leader) {
    return NextResponse.json({ error: 'Select team members and enter team name.' }, { status: 400 });
  }

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    const pc = (
      await c.query(
        `SELECT pc.*, ac.name cycle_name, pr.code program_code 
         FROM pbl_cycles_v2 pc 
         JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id 
         JOIN programs_v2 pr ON pr.id = pc.program_id
         WHERE pc.id = $1 FOR UPDATE`,
        [pblCycleId]
      )
    ).rows[0];

    if (!pc) throw new Error('PBL cycle not found');

    if (!u.roles.includes('HOD')) {
      const allowed = (
        await c.query(
          `SELECT 1 FROM pbl_coordinator_assignments_v2 
           WHERE id = $1 AND faculty_id = $2 AND is_active`,
          [pc.coordinator_assignment_id, u.facultyId]
        )
      ).rowCount;
      if (!allowed) throw new Error('You are not the PBL Coordinator for this semester');
    }

    const minSize = Number(pc.team_min_size) || 3;
    const maxSize = Number(pc.team_max_size) || 6;

    if (ids.length < minSize || ids.length > maxSize) {
      throw new Error(`Team must have ${minSize} to ${maxSize} students (selected: ${ids.length})`);
    }

    // Generate guaranteed unique team_code with institution tag (GMIT or GMU)
    const progTag = pc.program_code?.includes('GMIT') ? 'GMIT' : 'GMU';
    const cycleTag = pc.cycle_name ? pc.cycle_name.replace(/[^0-9]/g, '') : '202627';
    const prefix = `PBL-${progTag}-${cycleTag}-S${pc.semester}-`;
    
    // Fetch all existing team codes to prevent any global collision
    const allExistingTeamCodes = (
      await c.query(`SELECT team_code FROM teams_v2`)
    ).rows.map((r: any) => r.team_code);

    let seq = 1;
    let code = `${prefix}${String(seq).padStart(3, '0')}`;
    while (allExistingTeamCodes.includes(code)) {
      seq++;
      code = `${prefix}${String(seq).padStart(3, '0')}`;
    }

    const t = (
      await c.query(
        `INSERT INTO teams_v2(pbl_cycle_id, team_code, team_name, leader_enrollment_id, status, created_by) 
         VALUES($1, $2, $3, $4, 'DRAFT', $5) RETURNING id`,
        [pblCycleId, code, name, leader, u.id]
      )
    ).rows[0];

    for (const eid of ids) {
      await c.query(
        `INSERT INTO team_members_v2(team_id, enrollment_id, pbl_cycle_id, member_role, status) 
         VALUES($1, $2, $3, $4, 'ACTIVE')`,
        [t.id, eid, pblCycleId, eid === leader ? 'LEADER' : 'MEMBER']
      );
    }

    // Optional Guide Assignment
    if (guideFacultyId) {
      const finalTitle = rawProjectTitle || `${name} - Project`;
      const projPrefix = `PBL-SP-${progTag}-${pblCycleId}-`;
      const allExistingProjCodes = (
        await c.query(`SELECT project_code FROM projects_v2`)
      ).rows.map((r: any) => r.project_code);

      let pseq = 1;
      let projectCode = `${projPrefix}${String(pseq).padStart(4, '0')}`;
      while (allExistingProjCodes.includes(projectCode)) {
        pseq++;
        projectCode = `${projPrefix}${String(pseq).padStart(4, '0')}`;
      }

      const proj = (
        await c.query(
          `INSERT INTO projects_v2(
             pbl_cycle_id, project_code, title, short_description, description,
             problem_statement, expected_outcome, domain, technology_stack,
             project_type, owner_team_id, guide_faculty_id, max_teams,
             application_mode, status, published_at
           ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, 'STUDENT_PROJECT', $10, $11, 1, 'RESERVED', 'IN_PROGRESS', NOW())
           RETURNING id`,
          [
            pblCycleId,
            projectCode,
            finalTitle,
            `Project allocated to team ${name}`,
            `Project allocated to team ${name}`,
            `Project problem statement for team ${name}`,
            `Expected outcome for team ${name}`,
            'General',
            'Full Stack',
            t.id,
            guideFacultyId,
          ]
        )
      ).rows[0];

      await c.query(
        `INSERT INTO project_allocations_v2(project_id, team_id, guide_faculty_id, allocation_type, status)
         VALUES($1, $2, $3, 'STUDENT_PROJECT_CONFIRMED', 'ACTIVE')`,
        [proj.id, t.id, guideFacultyId]
      );

      await c.query(`UPDATE teams_v2 SET status = 'PROJECT_ASSIGNED' WHERE id = $1`, [t.id]);
    } else {
      await c.query(`UPDATE teams_v2 SET status = 'ACTIVE' WHERE id = $1`, [t.id]);
    }

    await c.query(
      `INSERT INTO audit_logs_v2(user_id, action, entity_type, entity_id, details) 
       VALUES($1, 'TEAM_CREATED', 'TEAM', $2, $3)`,
      [
        u.id,
        t.id,
        JSON.stringify({
          team_code: code,
          team_name: name,
          members: ids.length,
          guide_faculty_id: guideFacultyId,
        }),
      ]
    );

    await c.query('COMMIT');
    return NextResponse.redirect(new URL(`/coordinator/teams?cycle=${pblCycleId}`, req.url), 303);
  } catch (e: any) {
    await c.query('ROLLBACK');
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to create team' }, { status: 400 });
  } finally {
    c.release();
  }
}
