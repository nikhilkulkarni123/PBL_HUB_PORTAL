'use client';

import React, { useState, useMemo, useEffect } from 'react';
import FilterBar from './FilterBar';
import type { DirectoryFilterMeta } from '@/lib/filter-options';

export interface TeamRow {
  id: number;
  team_code: string;
  team_name: string;
  institution: string;
  semester: number;
  sections: string;
  status: string;
  members: string;
  project_title: string | null;
  guide_name: string | null;
  coordinator_name: string | null;
}

interface TeamsDirectoryProps {
  initialRows: TeamRow[];
  filterMeta: DirectoryFilterMeta;
  initialParams?: {
    institution?: string;
    sem?: string;
    section?: string;
    q?: string;
  };
}

export default function TeamsDirectory({
  initialRows,
  filterMeta,
  initialParams,
}: TeamsDirectoryProps) {
  const [institution, setInstitution] = useState(initialParams?.institution || '');
  const [semester, setSemester] = useState(initialParams?.sem || '');
  const [section, setSection] = useState(initialParams?.section || '');
  const [search, setSearch] = useState(initialParams?.q || '');

  // Synchronize URL query parameters with active filters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (institution) params.set('institution', institution);
    if (semester) params.set('sem', semester);
    if (section) params.set('section', section);
    if (search) params.set('q', search);

    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : '');
    window.history.replaceState(null, '', newUrl);
  }, [institution, semester, section, search]);

  const handleReset = () => {
    setInstitution('');
    setSemester('');
    setSection('');
    setSearch('');
  };

  const filteredRows = useMemo(() => {
    return initialRows.filter((r) => {
      if (institution && r.institution.toLowerCase() !== institution.toLowerCase()) {
        return false;
      }
      if (semester && String(r.semester) !== semester) {
        return false;
      }
      if (section) {
        const itemSections = r.sections
          ? r.sections.split(',').map((s) => s.trim().toLowerCase())
          : [];
        if (!itemSections.includes(section.toLowerCase())) {
          return false;
        }
      }
      if (search) {
        const query = search.toLowerCase();
        const matchCode = (r.team_code || '').toLowerCase().includes(query);
        const matchName = (r.team_name || '').toLowerCase().includes(query);
        const matchMembers = (r.members || '').toLowerCase().includes(query);
        const matchProj = (r.project_title || '').toLowerCase().includes(query);
        const matchGuide = (r.guide_name || '').toLowerCase().includes(query);
        const matchCoord = (r.coordinator_name || '').toLowerCase().includes(query);
        if (
          !matchCode &&
          !matchName &&
          !matchMembers &&
          !matchProj &&
          !matchGuide &&
          !matchCoord
        ) {
          return false;
        }
      }
      return true;
    });
  }, [initialRows, institution, semester, section, search]);

  return (
    <>
      <FilterBar
        institution={institution}
        onInstitutionChange={setInstitution}
        semester={semester}
        onSemesterChange={setSemester}
        section={section}
        onSectionChange={setSection}
        search={search}
        onSearchChange={setSearch}
        availableInstitutions={filterMeta.institutions}
        availableSemesters={filterMeta.semesters}
        allSectionMetas={filterMeta.sections}
        totalCount={initialRows.length}
        filteredCount={filteredRows.length}
        itemLabel="teams"
        searchPlaceholder="Search team ID, name, student name, project..."
        onReset={handleReset}
      />

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Team ID</th>
              <th>Team</th>
              <th>Students</th>
              <th>Semester / Section(s)</th>
              <th>PBL Coordinator</th>
              <th>Project / Guide</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map((r) => {
                const isGMIT = r.institution === 'GMIT';
                return (
                  <tr key={r.team_code}>
                    <td>
                      <span
                        className={`badge-inst ${
                          isGMIT ? 'badge-inst-gmit' : 'badge-inst-gmu'
                        }`}
                      >
                        {r.institution}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.team_code}</td>
                    <td style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      {r.team_name}
                    </td>
                    <td style={{ fontSize: '13px', lineHeight: '1.4' }}>
                      {r.members}
                    </td>
                    <td>
                      <span className="badge-sem" style={{ marginRight: '4px' }}>
                        Sem {r.semester}
                      </span>
                      {r.sections ? (
                        r.sections.split(',').map((s) => (
                          <span
                            key={s.trim()}
                            className="badge-sec"
                            style={{ marginRight: '4px' }}
                          >
                            Sec {s.trim()}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>{r.coordinator_name || '—'}</td>
                    <td>
                      {r.project_title ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--navy)' }}>
                            {r.project_title}
                          </div>
                          {r.guide_name && (
                            <small style={{ color: 'var(--muted)' }}>
                              Guide: {r.guide_name}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>Not allocated</span>
                      )}
                    </td>
                    <td>
                      <span
                        className="status"
                        style={{
                          fontSize: '11px',
                          background:
                            r.status === 'PROJECT_ASSIGNED' || r.status === 'COMPLETED'
                              ? '#e7f7ef'
                              : '#fff8e6',
                          color:
                            r.status === 'PROJECT_ASSIGNED' || r.status === 'COMPLETED'
                              ? 'var(--green)'
                              : '#975a16',
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                  <b>No teams match the selected filters.</b>
                  <p style={{ margin: '6px 0 14px' }}>
                    Try selecting another institution, semester, section, or clear your search keyword.
                  </p>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleReset}
                  >
                    Clear Filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
