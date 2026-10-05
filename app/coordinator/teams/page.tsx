import { requireAnyRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DeleteTeamButton from '@/components/DeleteTeamButton';

export default async function CoordinatorTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const u = await requireAnyRole(['PBL_COORDINATOR', 'HOD']);
  if (!u) redirect('/login');

  const q = await searchParams;
  const cycles = await query<any>(
    `SELECT pc.id, pc.semester, pc.team_min_size, pc.team_max_size, ac.name, pr.code program_code
     FROM pbl_cycles_v2 pc
     JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id
     JOIN programs_v2 pr ON pr.id = pc.program_id
     LEFT JOIN pbl_coordinator_assignments_v2 ca ON ca.id = pc.coordinator_assignment_id
     WHERE $1::boolean OR ca.faculty_id = $2
     ORDER BY pr.code, pc.semester`,
    [u.roles.includes('HOD'), u.facultyId || null]
  );

  const cycleId = Number(q.cycle || cycles[0]?.id || 0);
  const selectedCycle = cycles.find((c) => c.id === cycleId);

  let teams: any[] = [];
  let unassignedCount = 0;

  if (selectedCycle) {
    teams = await query<any>(
      `SELECT t.id, t.team_code, t.team_name, t.status, t.created_at,
              ls.name leader_name, ls.usn leader_usn,
              COUNT(tm.id) member_count,
              STRING_AGG(s.name || ' (' || s.usn || ' - Sec ' || se.code || ')', ' | ' ORDER BY (tm.member_role = 'LEADER') DESC, s.name) members_summary,
              MAX(p.title) project_title,
              MAX(f.name) guide_name
       FROM teams_v2 t
       JOIN pbl_cycles_v2 pc ON pc.id = t.pbl_cycle_id
       JOIN team_members_v2 tm ON tm.team_id = t.id
       JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
       JOIN students_v2 s ON s.id = e.student_id
       JOIN sections_v2 se ON se.id = e.section_id
       LEFT JOIN student_enrollments_v2 le ON le.id = t.leader_enrollment_id
       LEFT JOIN students_v2 ls ON ls.id = le.student_id
       LEFT JOIN project_allocations_v2 pa ON pa.team_id = t.id AND pa.status = 'ACTIVE'
       LEFT JOIN projects_v2 p ON p.id = pa.project_id
       LEFT JOIN faculty_v2 f ON f.id = pa.guide_faculty_id
       WHERE t.pbl_cycle_id = $1
       GROUP BY t.id, t.team_code, t.team_name, t.status, t.created_at, ls.name, ls.usn
       ORDER BY t.team_code ASC`,
      [cycleId]
    );

    const unassignedRes = await query<any>(
      `SELECT COUNT(e.id)::int unassigned_count
       FROM student_enrollments_v2 e
       LEFT JOIN team_members_v2 tm ON tm.enrollment_id = e.id AND tm.pbl_cycle_id = $1
       WHERE e.academic_cycle_id = (SELECT academic_cycle_id FROM pbl_cycles_v2 WHERE id = $1)
         AND e.program_id = (SELECT program_id FROM pbl_cycles_v2 WHERE id = $1)
         AND e.semester = (SELECT semester FROM pbl_cycles_v2 WHERE id = $1)
         AND tm.id IS NULL`,
      [cycleId]
    );
    unassignedCount = unassignedRes[0]?.unassigned_count || 0;
  }

  const totalAssignedStudents = teams.reduce((acc, t) => acc + Number(t.member_count || 0), 0);

  return (
    <section className="section">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Team Management</h1>
            <p className="lead" style={{ margin: '0.25rem 0 0' }}>
              Create teams, edit team names, assign leaders, and add or remove team members.
            </p>
          </div>
          {selectedCycle && (
            <Link
              href={`/coordinator/teams/new?cycle=${cycleId}`}
              className="btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
            >
              Create New Team
            </Link>
          )}
        </div>

        {/* PBL Cycle Selector */}
        <form method="get" className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <label style={{ fontWeight: 600 }}>Select PBL Cycle / Semester:</label>
          <select name="cycle" defaultValue={cycleId} style={{ minWidth: '280px', padding: '0.5rem 0.75rem' }}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.program_code === 'GMIT-CSE' ? '[GMIT] ' : '[GMU] '}
                {c.name} — Semester {c.semester}
              </option>
            ))}
          </select>
          <button className="btn secondary">Load Cycle</button>
        </form>

        {selectedCycle && (
          <>
            {/* Quick Metrics */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>{teams.length}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>Total Formed Teams</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>{totalAssignedStudents}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>Students in Teams</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>{unassignedCount}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>Unassigned Students</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>{selectedCycle.team_min_size} - {selectedCycle.team_max_size}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>Team Size Rule (Min - Max)</div>
              </div>
            </div>

            {/* Teams Table */}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Team ID</th>
                    <th>Team Name</th>
                    <th>Leader</th>
                    <th>Size</th>
                    <th>Members</th>
                    <th>Project / Guide</th>
                    <th>Status</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.length > 0 ? (
                    teams.map((t) => (
                      <tr key={t.id}>
                        <td><strong>{t.team_code}</strong></td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{t.team_name}</span>
                        </td>
                        <td>
                          {t.leader_name ? (
                            <div>
                              <div>{t.leader_name}</div>
                              <small style={{ color: 'var(--muted, #666)' }}>{t.leader_usn}</small>
                            </div>
                          ) : (
                            <span style={{ color: '#ef4444' }}>No Leader</span>
                          )}
                        </td>
                        <td>
                          <span className="badge">
                            {t.member_count} / {selectedCycle.team_max_size}
                          </span>
                        </td>
                        <td style={{ maxWidth: '320px', fontSize: '0.85rem', lineHeight: '1.4' }}>
                          {t.members_summary ? t.members_summary.split(' | ').map((m: string, idx: number) => (
                            <div key={idx} style={{ margin: '2px 0' }}>• {m}</div>
                          )) : '—'}
                        </td>
                        <td>
                          {t.project_title ? (
                            <div>
                              <strong>{t.project_title}</strong>
                              {t.guide_name && (
                                <div><small style={{ color: 'var(--muted, #666)' }}>Guide: {t.guide_name}</small></div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted, #888)', fontStyle: 'italic' }}>Not allocated</span>
                          )}
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: t.status === 'ACTIVE' ? '#dcfce7' : t.status === 'PROJECT_ASSIGNED' ? '#dbeafe' : '#f1f5f9',
                            color: t.status === 'ACTIVE' ? '#166534' : t.status === 'PROJECT_ASSIGNED' ? '#1e40af' : '#334155'
                          }}>
                            {t.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                            <Link
                              href={`/coordinator/teams/${t.id}/edit`}
                              className="btn secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', color: '#000000', borderColor: '#000000' }}
                              title="Edit team name, leader, members, and guide"
                            >
                              Edit
                            </Link>
                            <DeleteTeamButton
                              teamId={Number(t.id)}
                              teamCode={t.team_code}
                              teamName={t.team_name}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                        <div>No teams have been formed yet for this cycle.</div>
                        <div style={{ marginTop: '0.75rem' }}>
                          <Link href={`/coordinator/teams/new?cycle=${cycleId}`} className="btn">
                            Form the First Team
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
