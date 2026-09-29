'use client';

import { useMemo, useState } from 'react';

type Student = {
  enrollment_id: number | string;
  usn: string;
  name: string;
  section_code: string;
  mentor_name: string | null;
};

export default function StudentTeamSelector({
  students,
  pblCycleId,
  semester,
  minSize,
  maxSize,
}: {
  students: Student[];
  pblCycleId: number;
  semester: number;
  minSize: number;
  maxSize: number;
}) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('ALL');
  const [selected, setSelected] = useState<string[]>([]);
  const [leader, setLeader] = useState<string>('');

  const effectiveMin = Number(minSize) || 4;
  const effectiveMax = Number(maxSize) || 6;

  // Automatically default leader to first selected student if empty or unselected
  const effectiveLeader = leader && selected.includes(leader) ? leader : (selected[0] || '');

  const sections = useMemo(
    () => Array.from(new Set(students.map((s) => s.section_code))).sort(),
    [students],
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
    [students, selected],
  );

  const leaderStudent = useMemo(
    () => selectedStudents.find((s) => String(s.enrollment_id) === effectiveLeader),
    [selectedStudents, effectiveLeader],
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
        <label>Team name</label>
        <input name="teamName" placeholder="Enter team name" required />
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
                  {x}
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
                        ⭐ Team Leader
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
                    <td>{s.section_code}</td>
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
        <label>Team leader</label>
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

      {selected.length > 0 && selected.length < effectiveMin && (
        <div className="notice" style={{ background: '#fff8e6', borderColor: '#f3cf7a' }}>
          Select <b>{effectiveMin - selected.length}</b> more student(s) to reach the minimum team size of {effectiveMin}.
        </div>
      )}

      {ready && (
        <div className="notice" style={{ background: '#eafaf1', borderColor: '#a3e6c0', color: '#0f5132' }}>
          ✓ Ready to create team! <b>{selected.length}</b> students selected with <b>{leaderStudent?.name || 'leader selected'}</b> as Team Leader.
        </div>
      )}

      <button type="submit" className="btn" disabled={!ready}>
        Create &amp; Activate Team
      </button>
    </form>
  );
}
