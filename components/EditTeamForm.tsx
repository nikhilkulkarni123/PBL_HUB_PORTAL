'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export type TeamMember = {
  enrollment_id: number | string;
  usn: string;
  name: string;
  section_code: string;
  mentor_name: string | null;
  member_role: 'LEADER' | 'MEMBER';
};

export type AvailableStudent = {
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

type Props = {
  team: {
    id: number;
    team_code: string;
    team_name: string;
    leader_enrollment_id: number;
    pbl_cycle_id: number;
    min_size: number;
    max_size: number;
    program_code: string;
    cycle_name: string;
    semester: number;
    guide_faculty_id?: number | null;
    project_title?: string;
  };
  initialMembers: TeamMember[];
  availableStudents: AvailableStudent[];
  facultyList?: FacultyGuide[];
};

export default function EditTeamForm({ team, initialMembers, availableStudents, facultyList = [] }: Props) {
  const router = useRouter();

  const [teamName, setTeamName] = useState(team.team_name);
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [leaderId, setLeaderId] = useState<number>(Number(team.leader_enrollment_id) || Number(initialMembers[0]?.enrollment_id) || 0);
  const [guideFacultyId, setGuideFacultyId] = useState<string>(team.guide_faculty_id ? String(team.guide_faculty_id) : '');
  const [projectTitle, setProjectTitle] = useState<string>(team.project_title || '');
  
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const minSize = Number(team.min_size) || 3;
  const maxSize = Number(team.max_size) || 6;

  // Compute available students list (students not currently in members)
  const currentMemberIds = useMemo(() => new Set(members.map(m => Number(m.enrollment_id))), [members]);
  
  const unassignedStudents = useMemo(() => {
    return availableStudents.filter(s => !currentMemberIds.has(Number(s.enrollment_id)));
  }, [availableStudents, currentMemberIds]);

  const sections = useMemo(() => {
    return Array.from(new Set(availableStudents.map(s => s.section_code))).sort();
  }, [availableStudents]);

  const filteredUnassigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unassignedStudents.filter(s => {
      const matchSec = sectionFilter === 'ALL' || s.section_code === sectionFilter;
      const matchSearch = !q || s.usn.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      return matchSec && matchSearch;
    });
  }, [unassignedStudents, search, sectionFilter]);

  function handleRemoveMember(enrollmentId: number | string) {
    const idNum = Number(enrollmentId);
    const updated = members.filter(m => Number(m.enrollment_id) !== idNum);
    setMembers(updated);
    
    // If removed member was the leader, assign leader to the first remaining member
    if (leaderId === idNum && updated.length > 0) {
      setLeaderId(Number(updated[0].enrollment_id));
    }
  }

  function handleAddMember(student: AvailableStudent) {
    if (members.length >= maxSize) {
      setError(`Cannot add more than ${maxSize} members.`);
      return;
    }
    setError(null);
    const newMember: TeamMember = {
      enrollment_id: student.enrollment_id,
      usn: student.usn,
      name: student.name,
      section_code: student.section_code,
      mentor_name: student.mentor_name,
      member_role: members.length === 0 ? 'LEADER' : 'MEMBER',
    };
    const updated = [...members, newMember];
    setMembers(updated);
    if (!leaderId || members.length === 0) {
      setLeaderId(Number(student.enrollment_id));
    }
  }

  function handleSetLeader(enrollmentId: number | string) {
    setLeaderId(Number(enrollmentId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setError('Please enter a team name.');
      return;
    }

    if (members.length < minSize) {
      setError(`Team size is too small. Minimum required is ${minSize} members (currently ${members.length}).`);
      return;
    }

    if (members.length > maxSize) {
      setError(`Team size exceeds maximum limit of ${maxSize} members (currently ${members.length}).`);
      return;
    }

    if (!leaderId || !members.some(m => Number(m.enrollment_id) === leaderId)) {
      setError('Please select a team leader from the member list.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/coordinator/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: trimmedName,
          leaderEnrollmentId: leaderId,
          enrollmentIds: members.map(m => Number(m.enrollment_id)),
          guideFacultyId: guideFacultyId ? Number(guideFacultyId) : null,
          projectTitle: projectTitle.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update team.');
      }

      setSuccess('Team updated successfully! Redirecting...');
      setTimeout(() => {
        router.push(`/coordinator/teams?cycle=${team.pbl_cycle_id}`);
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  const isValidSize = members.length >= minSize && members.length <= maxSize;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Info Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>
            {team.program_code === 'GMIT-CSE' ? ' [GMIT] ' : ' [GMU] '}
            {team.team_code} · {team.cycle_name} (Semester {team.semester})
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted, #666)' }}>
            Allowed Team Size: <strong>{minSize} to {maxSize} members</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/coordinator/teams?cycle=${team.pbl_cycle_id}`} className="btn secondary">
            Back to Teams
          </Link>
        </div>
      </div>

      {error && (
        <div className="notice" style={{ background: '#fee2e2', borderColor: '#ef4444', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="notice" style={{ background: '#dcfce7', borderColor: '#22c55e', color: '#166534' }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Team Name Input */}
        <div className="card">
          <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
            Team Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            className="input"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., CodeCrafters, NeuralNex"
            style={{ width: '100%', maxWidth: '500px', fontSize: '1.05rem', padding: '0.6rem 0.8rem' }}
            required
          />
        </div>

        {/* Current Team Members Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Current Team Members ({members.length})</h3>
              <span style={{ fontSize: '0.85rem', color: isValidSize ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {members.length < minSize && `Need at least ${minSize - members.length} more student(s) to reach minimum size of ${minSize}`}
                {members.length > maxSize && `Exceeds max limit by ${members.length - maxSize} student(s)`}
                {isValidSize && `Valid team size (${members.length} / ${maxSize})`}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>
              Select radio button to designate <strong>Team Leader</strong>
            </div>
          </div>

          {members.length === 0 ? (
            <div className="notice" style={{ textAlign: 'center', padding: '1.5rem' }}>
              No members in this team. Please add students from the list below.
            </div>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '90px', textAlign: 'center' }}>Leader</th>
                    <th>USN</th>
                    <th>Student Name</th>
                    <th>Section</th>
                    <th>Mentor</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isLeader = Number(m.enrollment_id) === leaderId;
                    return (
                      <tr key={String(m.enrollment_id)} style={isLeader ? { background: 'rgba(59, 130, 246, 0.06)' } : {}}>
                        <td style={{ textAlign: 'center' }}>
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <input
                              type="radio"
                              name="teamLeaderRadio"
                              checked={isLeader}
                              onChange={() => handleSetLeader(m.enrollment_id)}
                            />
                            {isLeader && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>LEAD</span>}
                          </label>
                        </td>
                        <td><strong>{m.usn}</strong></td>
                        <td>{m.name}</td>
                        <td><span className="badge">{m.section_code}</span></td>
                        <td>{m.mentor_name || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.enrollment_id)}
                            className="btn secondary"
                            style={{ padding: '0.25rem 0.6rem', color: '#000000', borderColor: '#000000', fontSize: '0.85rem' }}
                            title="Remove student from this team"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Members Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>
              Add Available Students ({unassignedStudents.length} available)
            </h3>
            {members.length >= maxSize && (
              <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                Team capacity reached ({maxSize}/{maxSize})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search available student by USN or Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.75rem' }}
            />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              style={{ minWidth: '140px', padding: '0.45rem 0.75rem' }}
            >
              <option value="ALL">All Sections ({sections.join(', ')})</option>
              {sections.map((sec) => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: '6px' }}>
            {filteredUnassigned.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted, #666)' }}>
                {unassignedStudents.length === 0
                  ? 'All eligible students in this semester are already in teams.'
                  : 'No matching unassigned students found.'}
              </div>
            ) : (
              <table style={{ margin: 0, width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle, #f9fafb)', position: 'sticky', top: 0 }}>
                    <th>USN</th>
                    <th>Student Name</th>
                    <th>Section</th>
                    <th>Mentor</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnassigned.map((s) => (
                    <tr key={String(s.enrollment_id)}>
                      <td><strong>{s.usn}</strong></td>
                      <td>{s.name}</td>
                      <td><span className="badge">{s.section_code}</span></td>
                      <td>{s.mentor_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleAddMember(s)}
                          disabled={members.length >= maxSize}
                          className="btn secondary"
                          style={{
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.85rem',
                            cursor: members.length >= maxSize ? 'not-allowed' : 'pointer',
                            opacity: members.length >= maxSize ? 0.5 : 1,
                          }}
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Guide Assignment Section */}
        <div className="card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Assign / Update Project Guide <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--muted, #666)' }}>(Optional)</span>
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--muted, #666)' }}>
            Assign or reassign a faculty guide for this team. Leaving it unassigned allows students to choose or be assigned later.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Project Guide Faculty</label>
              <select
                value={guideFacultyId}
                onChange={(e) => setGuideFacultyId(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem' }}
              >
                <option value="">-- No Guide Assigned --</option>
                {facultyList.map((f) => {
                  const isCurrentGuide = String(f.id) === String(team.guide_faculty_id);
                  const semAvailable = f.semester_max - f.semester_load;
                  const totalAvailable = f.overall_max - f.total_load;
                  const isFull = !isCurrentGuide && (semAvailable <= 0 || totalAvailable <= 0);
                  return (
                    <option key={f.id} value={f.id} disabled={isFull}>
                      {f.name} ({f.employee_id}) — Load: {f.semester_load}/{f.semester_max} sem, {f.total_load}/{f.overall_max} total {isFull ? '(FULL)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {guideFacultyId && (
              <div>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Project Title (Optional)</label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Enter project title"
                  style={{ width: '100%', padding: '0.55rem 0.75rem' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={saving || !isValidSize}
            className="btn"
            style={{
              padding: '0.75rem 1.75rem',
              fontSize: '1rem',
              cursor: saving || !isValidSize ? 'not-allowed' : 'pointer',
              opacity: saving || !isValidSize ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Team Changes'}
          </button>
          <Link href={`/coordinator/teams?cycle=${team.pbl_cycle_id}`} className="btn secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
