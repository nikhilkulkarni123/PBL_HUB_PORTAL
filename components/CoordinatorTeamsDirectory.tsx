'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import DeleteTeamButton from './DeleteTeamButton';

export interface CoordinatorTeamItem {
  id: number;
  team_code: string;
  team_name: string;
  status: string;
  created_at: string;
  leader_name: string | null;
  leader_usn: string | null;
  member_count: number;
  members_summary: string | null;
  sections: string;
  project_title: string | null;
  guide_name: string | null;
}

interface CoordinatorTeamsDirectoryProps {
  teams: CoordinatorTeamItem[];
  selectedCycle: {
    id: number;
    semester: number;
    team_min_size: number;
    team_max_size: number;
    name: string;
    program_code: string;
  };
  availableSections: string[];
  unassignedCount: number;
  totalAssignedStudents: number;
}

export default function CoordinatorTeamsDirectory({
  teams,
  selectedCycle,
  availableSections,
  unassignedCount,
  totalAssignedStudents,
}: CoordinatorTeamsDirectoryProps) {
  const [sectionFilter, setSectionFilter] = useState('');
  const [allocationFilter, setAllocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Extract unique statuses present in teams
  const availableStatuses = useMemo(() => {
    return Array.from(new Set(teams.map((t) => t.status))).filter(Boolean).sort();
  }, [teams]);

  // Handle filter resets
  const handleReset = () => {
    setSectionFilter('');
    setAllocationFilter('');
    setStatusFilter('');
    setSearch('');
  };

  // Filter teams based on selected criteria
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      // 1. Section Filter
      if (sectionFilter) {
        const teamSections = t.sections
          ? t.sections.split(',').map((s) => s.trim().toLowerCase())
          : [];
        if (!teamSections.includes(sectionFilter.toLowerCase())) {
          return false;
        }
      }

      // 2. Allocation Filter (Allocated vs Not Allocated)
      if (allocationFilter === 'ALLOCATED') {
        if (!t.project_title) return false;
      } else if (allocationFilter === 'UNALLOCATED') {
        if (t.project_title) return false;
      }

      // 3. Status Filter
      if (statusFilter && t.status !== statusFilter) {
        return false;
      }

      // 4. Search Keyword Filter
      if (search) {
        const q = search.toLowerCase();
        const matchCode = (t.team_code || '').toLowerCase().includes(q);
        const matchName = (t.team_name || '').toLowerCase().includes(q);
        const matchLeader = (t.leader_name || '').toLowerCase().includes(q);
        const matchUsn = (t.leader_usn || '').toLowerCase().includes(q);
        const matchMembers = (t.members_summary || '').toLowerCase().includes(q);
        const matchProj = (t.project_title || '').toLowerCase().includes(q);
        const matchGuide = (t.guide_name || '').toLowerCase().includes(q);

        if (
          !matchCode &&
          !matchName &&
          !matchLeader &&
          !matchUsn &&
          !matchMembers &&
          !matchProj &&
          !matchGuide
        ) {
          return false;
        }
      }

      return true;
    });
  }, [teams, sectionFilter, allocationFilter, statusFilter, search]);

  const hasActiveFilters = Boolean(
    sectionFilter || allocationFilter || statusFilter || search
  );

  return (
    <>
      {/* Quick Metrics */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>
            {hasActiveFilters ? `${filteredTeams.length} / ${teams.length}` : teams.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>
            {hasActiveFilters ? 'Matching / Total Teams' : 'Total Formed Teams'}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>
            {totalAssignedStudents}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>
            Students in Teams
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>
            {unassignedCount}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>
            Unassigned Students
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#000000' }}>
            {selectedCycle.team_min_size} - {selectedCycle.team_max_size}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted, #666)' }}>
            Team Size Rule (Min - Max)
          </div>
        </div>
      </div>

      {/* Team Management Filters Bar */}
      <div className="filter-card">
        <div className="filter-card-header">
          <div className="filter-title">
            <span>⚙️</span> Filter &amp; Search Cycle Teams
          </div>
          <span className="result-count-badge">
            Showing <b>{filteredTeams.length}</b> of <b>{teams.length}</b> teams
          </span>
        </div>

        <div className="filter-grid">
          {/* Section Filter */}
          <div className="filter-field">
            <label htmlFor="coord-filter-section">Section</label>
            <select
              id="coord-filter-section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="">All Sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Allocation Status Filter */}
          <div className="filter-field">
            <label htmlFor="coord-filter-alloc">Project Allocation</label>
            <select
              id="coord-filter-alloc"
              value={allocationFilter}
              onChange={(e) => setAllocationFilter(e.target.value)}
            >
              <option value="">All Allocations</option>
              <option value="ALLOCATED">Project Allocated</option>
              <option value="UNALLOCATED">Pending Allocation (No Project)</option>
            </select>
          </div>

          {/* Team Status Filter */}
          <div className="filter-field">
            <label htmlFor="coord-filter-status">Team Status</label>
            <select
              id="coord-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Search Keyword */}
          <div className="filter-field" style={{ minWidth: '240px' }}>
            <label htmlFor="coord-filter-search">Search Keyword</label>
            <input
              id="coord-filter-search"
              type="text"
              placeholder="Search team ID, name, student USN, guide..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Active Filters and Reset */}
        {hasActiveFilters && (
          <div className="filter-actions">
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
              Active Filters:
            </span>

            {sectionFilter && (
              <button
                type="button"
                className="filter-pill"
                onClick={() => setSectionFilter('')}
                title="Remove Section filter"
              >
                Section: {sectionFilter} <span className="pill-close">×</span>
              </button>
            )}

            {allocationFilter && (
              <button
                type="button"
                className="filter-pill"
                onClick={() => setAllocationFilter('')}
                title="Remove Allocation filter"
              >
                Project: {allocationFilter === 'ALLOCATED' ? 'Allocated' : 'Pending'}{' '}
                <span className="pill-close">×</span>
              </button>
            )}

            {statusFilter && (
              <button
                type="button"
                className="filter-pill"
                onClick={() => setStatusFilter('')}
                title="Remove Status filter"
              >
                Status: {statusFilter} <span className="pill-close">×</span>
              </button>
            )}

            {search && (
              <button
                type="button"
                className="filter-pill"
                onClick={() => setSearch('')}
                title="Clear search keyword"
              >
                Search: &quot;{search}&quot; <span className="pill-close">×</span>
              </button>
            )}

            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 10px', fontSize: '12px', marginLeft: 'auto' }}
              onClick={handleReset}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Teams Table */}
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Team ID</th>
              <th>Team Name</th>
              <th>Section(s)</th>
              <th>Leader</th>
              <th>Size</th>
              <th>Members</th>
              <th>Project / Guide</th>
              <th>Status</th>
              <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.length > 0 ? (
              filteredTeams.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.team_code}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{t.team_name}</span>
                  </td>
                  <td>
                    {t.sections ? (
                      t.sections.split(',').map((sec) => (
                        <span
                          key={sec.trim()}
                          className="badge-sec"
                          style={{ marginRight: '4px' }}
                        >
                          Sec {sec.trim()}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {t.leader_name ? (
                      <div>
                        <div>{t.leader_name}</div>
                        <small style={{ color: 'var(--muted, #666)' }}>
                          {t.leader_usn}
                        </small>
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
                  <td
                    style={{
                      maxWidth: '320px',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                    }}
                  >
                    {t.members_summary ? (
                      t.members_summary.split(' | ').map((m: string, idx: number) => (
                        <div key={idx} style={{ margin: '2px 0' }}>
                          • {m}
                        </div>
                      ))
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {t.project_title ? (
                      <div>
                        <strong>{t.project_title}</strong>
                        {t.guide_name && (
                          <div>
                            <small style={{ color: 'var(--muted, #666)' }}>
                              Guide: {t.guide_name}
                            </small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted, #888)', fontStyle: 'italic' }}>
                        Not allocated
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          t.status === 'ACTIVE'
                            ? '#dcfce7'
                            : t.status === 'PROJECT_ASSIGNED'
                            ? '#dbeafe'
                            : '#f1f5f9',
                        color:
                          t.status === 'ACTIVE'
                            ? '#166534'
                            : t.status === 'PROJECT_ASSIGNED'
                            ? '#1e40af'
                            : '#334155',
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.4rem',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Link
                        href={`/coordinator/teams/${t.id}/edit`}
                        className="btn secondary"
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.85rem',
                          color: '#000000',
                          borderColor: '#000000',
                        }}
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
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted)' }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                  <b>No teams match the selected filter criteria.</b>
                  <p style={{ margin: '6px 0 14px' }}>
                    Try clearing or relaxing your Section, Status, or Keyword search filters.
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={handleReset}
                    >
                      Reset Filters
                    </button>
                  ) : (
                    <Link
                      href={`/coordinator/teams/new?cycle=${selectedCycle.id}`}
                      className="btn"
                    >
                      Form the First Team
                    </Link>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
