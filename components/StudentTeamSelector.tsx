'use client';

import { useMemo, useState } from 'react';

export type Student = {
  enrollment_id: number | string;
  usn: string;
  name: string;
  section_code: string;
  mentor_name: string | null;
};

export type FacultyGuide = {
  id: number;
  employee_id: string;
  name: string;
  designation: string | null;
  department: string | null;
  overall_max: number;
  semester_max: number;
  semester_load: number;
  total_load: number;
};

export default function StudentTeamSelector({
  students,
  facultyList = [],
  pblCycleId,
  semester,
  minSize,
  maxSize,
}: {
  students: Student[];
  facultyList?: FacultyGuide[];
  pblCycleId: number;
  semester: number;
  minSize: number;
  maxSize: number;
}) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [leader, setLeader] = useState<string>('');
  const [guideFacultyId, setGuideFacultyId] = useState<string>('');
  const [projectTitle, setProjectTitle] = useState<string>('');

  const effectiveMin = Number(minSize) || 3;
  const effectiveMax = Number(maxSize) || 6;

  // Automatically default leader to first selected student if empty or unselected
  const effectiveLeader = leader && selected.includes(leader) ? leader : selected[0] || '';

  const sections = useMemo(
    () => Array.from(new Set(students.map((s) => s.section_code))).sort(),
    [students]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const sectionOk = section === 'ALL' || s.section_code === section;
      const searchOk = !q || s.usn.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      return sectionOk && searchOk;
    });
  }, [students, search, section]);

  const selectedStudents = useMemo(
    () => students.filter((s) => selected.includes(String(s.enrollment_id))),
    [students, selected]
  );

  const leaderStudent = useMemo(
    () => selectedStudents.find((s) => String(s.enrollment_id) === effectiveLeader),
    [selectedStudents, effectiveLeader]
  );

  const selectedGuide = useMemo(
    () => facultyList.find((f) => String(f.id) === guideFacultyId),
    [facultyList, guideFacultyId]
  );

  function toggle(id: number | string) {
    const strId = String(id);
    setSelected((current) => {
      if (current.includes(strId)) {
        const next = current.filter((x) => x !== strId);
        if (leader === strId) {
          setLeader(next[0] || '');
        }
        return next;
      }
      if (current.length >= effectiveMax) return current;
      const next = [...current, strId];
      if (!leader) {
        setLeader(strId);
      }
      return next;
    });
  }

  function remove(id: number | string) {
    const strId = String(id);
    setSelected((current) => {
      const next = current.filter((x) => x !== strId);
      if (leader === strId) {
        setLeader(next[0] || '');
      }
      return next;
    });
  }

  const ready =
    selected.length >= effectiveMin &&
    selected.length <= effectiveMax &&
    Boolean(effectiveLeader);

  return (
    <form action="/api/teams" method="post" className="form">
      <input type="hidden" name="pblCycleId" value={pblCycleId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="enrollmentIds" value={id} />
      ))}

      <div className="field">
        <label>Team Name <span style={{ color: '#ef4444' }}>*</span></label>
        <input name="teamName" placeholder="Enter team name (e.g. CodeWarriors, CyberShield)" required />
      </div>

      <div className="card">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px,1fr) minmax(170px,240px)',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Search student</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by USN or student name"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Section</label>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="ALL">All Sections</option>
              {sections.map((x) => (
                <option key={x} value={x}>
                  Section {x}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="notice">
        <b>
          Selected: {selected.length} / {effectiveMax}
        </b>{' '}
        · Team size must be between {effectiveMin} and {effectiveMax} students. Semester {semester} students only.
      </div>

      {selectedStudents.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Selected Students ({selectedStudents.length})</h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {selectedStudents.map((s, index) => {
              const strId = String(s.enrollment_id);
              const isLeader = effectiveLeader === strId;
              return (
                <div
                  key={strId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <b>
                      {index + 1}. {s.usn}
                    </b>{' '}
                    — {s.name} <span className="muted">({s.section_code})</span>
                    {isLeader && (
                      <span
                        className="status"
                        style={{ background: '#e7f7ef', color: '#0f8a5f', fontSize: '11px', padding: '2px 8px' }}
                      >
                        Team Leader
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isLeader && (
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => setLeader(strId)}
                      >
                        Make Leader
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ fontSize: '12px', padding: '4px 10px', color: '#c0392b', borderColor: '#c0392b' }}
                      onClick={() => remove(strId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>USN</th>
              <th>Student Name</th>
              <th>Section</th>
              <th>Mentor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((s) => {
                const strId = String(s.enrollment_id);
                const checked = selected.includes(strId);
                const disabled = !checked && selected.length >= effectiveMax;
                return (
                  <tr key={strId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(strId)}
                        aria-label={`Select ${s.usn} ${s.name}`}
                      />
                    </td>
                    <td>
                      <b>{s.usn}</b>
                    </td>
                    <td>{s.name}</td>
                    <td><span className="badge">{s.section_code}</span></td>
                    <td>{s.mentor_name || '—'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>No eligible students match the current search/filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="field">
        <label>Team Leader <span style={{ color: '#ef4444' }}>*</span></label>
        <select
          name="leaderEnrollmentId"
          required
          value={effectiveLeader}
          onChange={(e) => setLeader(e.target.value)}
        >
          {selectedStudents.length === 0 && (
            <option value="">Select students from the table above first</option>
          )}
          {selectedStudents.map((s) => {
            const strId = String(s.enrollment_id);
            return (
              <option key={strId} value={strId}>
                {s.usn} — {s.name} {effectiveLeader === strId ? '(Team Leader)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Guide Assignment Section */}
      <div className="card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Assign Project Guide <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--muted, #666)' }}>(Optional)</span>
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--muted, #666)' }}>
          You can assign a faculty guide to this team right now during team creation, or assign/change it later.
        </p>

        <div className="field">
          <label>Project Guide Faculty</label>
          <select
            name="guideFacultyId"
            value={guideFacultyId}
            onChange={(e) => setGuideFacultyId(e.target.value)}
          >
            <option value="">-- No Guide Assigned Yet (Can assign later) --</option>
            {facultyList.map((f) => {
              const semAvailable = f.semester_max - f.semester_load;
              const totalAvailable = f.overall_max - f.total_load;
              const isFull = semAvailable <= 0 || totalAvailable <= 0;
              return (
                <option key={f.id} value={f.id} disabled={isFull}>
                  {f.name} ({f.employee_id}) — Load: {f.semester_load}/{f.semester_max} sem, {f.total_load}/{f.overall_max} total {isFull ? '(FULL)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {guideFacultyId && (
          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label>Project Title (Optional)</label>
            <input
              name="projectTitle"
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Enter project title (or leave blank to auto-generate from team name)"
            />
          </div>
        )}
      </div>

      {selected.length > 0 && selected.length < effectiveMin && (
        <div className="notice" style={{ background: '#fff8e6', borderColor: '#f3cf7a' }}>
          Select <b>{effectiveMin - selected.length}</b> more student(s) to reach the minimum team size of {effectiveMin}.
        </div>
      )}

      {ready && (
        <div className="notice" style={{ background: '#eafaf1', borderColor: '#a3e6c0', color: '#0f5132' }}>
          Ready to create team: <b>{selected.length}</b> students selected with <b>{leaderStudent?.name || 'leader selected'}</b> as Team Leader
          {selectedGuide ? ` and ${selectedGuide.name} assigned as Guide.` : '.'}
        </div>
      )}

      <button type="submit" className="btn" disabled={!ready}>
        Create &amp; Activate Team
      </button>
    </form>
  );
}
