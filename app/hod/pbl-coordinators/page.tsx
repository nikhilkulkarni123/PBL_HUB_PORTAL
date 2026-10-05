import { requireAnyRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';

export default async function Coordinators() {
  if (!await requireAnyRole(['HOD'])) redirect('/login');

  const cycles = await query<any>(`
    SELECT pc.id, ac.name as cycle_name, pc.semester, f.name as coordinator_name, pca.faculty_id,
           pr.code as program_code, pr.name as program_name
    FROM pbl_cycles_v2 pc
    JOIN academic_cycles_v2 ac ON ac.id = pc.academic_cycle_id
    JOIN programs_v2 pr ON pr.id = pc.program_id
    LEFT JOIN pbl_coordinator_assignments_v2 pca ON pca.id = pc.coordinator_assignment_id
    LEFT JOIN faculty_v2 f ON f.id = pca.faculty_id
    ORDER BY CASE WHEN pr.code = 'GMIT-CSE' THEN 1 ELSE 0 END, pc.semester
  `);

  const fac = await query<any>('SELECT id, employee_id, name FROM faculty_v2 WHERE is_active ORDER BY name');

  return (
    <section className="section">
      <div className="container">
        <h1>PBL Coordinator Assignment</h1>
        <p>Exactly one active PBL Coordinator is assigned per semester for an academic cycle.</p>
        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {cycles.map((c: any) => {
            const isGMIT = c.program_code === 'GMIT-CSE';
            const instTag = isGMIT ? 'GMIT' : 'GMU';
            const instFullName = isGMIT ? 'GM Institute of Technology (GMIT)' : 'GM University (GMU)';
            const badgeBg = isGMIT ? '#fef3c7' : '#e0f2fe';
            const badgeColor = isGMIT ? '#92400e' : '#0369a1';
            const borderColor = isGMIT ? '#fcd34d' : '#bae6fd';

            return (
              <div
                className="card"
                key={c.id}
                style={{ borderLeft: `6px solid ${isGMIT ? '#d97706' : '#0284c7'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${borderColor}`,
                        letterSpacing: '0.5px',
                      }}
                    >
                      {instTag}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                      {instFullName} — {c.program_name || c.program_code}
                    </span>
                  </div>
                  <span className="tag">{c.cycle_name}</span>
                </div>

                <h2 style={{ margin: '8px 0 12px 0' }}>
                  {instTag} — {c.cycle_name} — Semester {c.semester}
                </h2>

                <p style={{ margin: '4px 0 16px 0', fontSize: '15px' }}>
                  Current Coordinator:{' '}
                  <b>
                    {c.coordinator_name ? (
                      <span style={{ color: '#0f172a' }}>{c.coordinator_name}</span>
                    ) : (
                      <span style={{ color: '#dc2626' }}>Not assigned</span>
                    )}
                  </b>
                </p>

                <form action="/api/hod/pbl-coordinators" method="post" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="hidden" name="pblCycleId" value={c.id} />
                  <select name="facultyId" defaultValue={c.faculty_id || ''} required style={{ maxWidth: '380px' }}>
                    <option value="">Select Faculty</option>
                    {fac.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.employee_id} — {f.name}
                      </option>
                    ))}
                  </select>{' '}
                  <button className="btn">Assign / Change</button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

