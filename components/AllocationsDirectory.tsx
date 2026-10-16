'use client';

import React, { useState, useMemo, useEffect } from 'react';
import FilterBar from './FilterBar';
import type { DirectoryFilterMeta } from '@/lib/filter-options';

export interface AllocationRow {
  institution: string;
  semester: number;
  sections: string;
  team_code: string;
  team_name: string;
  project_title: string;
  project_type: string;
  owner_name: string;
  guide_name: string;
  status: string;
}

interface AllocationsDirectoryProps {
  initialRows: AllocationRow[];
  filterMeta: DirectoryFilterMeta;
  initialParams?: {
    institution?: string;
    sem?: string;
    section?: string;
    q?: string;
  };
}

export default function AllocationsDirectory({
  initialRows,
  filterMeta,
  initialParams,
}: AllocationsDirectoryProps) {
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
        const matchTitle = (r.project_title || '').toLowerCase().includes(query);
        const matchTeam = (r.team_name || '').toLowerCase().includes(query);
        const matchCode = (r.team_code || '').toLowerCase().includes(query);
        const matchOwner = (r.owner_name || '').toLowerCase().includes(query);
        const matchGuide = (r.guide_name || '').toLowerCase().includes(query);
        if (!matchTitle && !matchTeam && !matchCode && !matchOwner && !matchGuide) {
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
        itemLabel="allocations"
        searchPlaceholder="Search project, team code, guide, owner..."
        onReset={handleReset}
      />

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Semester</th>
              <th>Section(s)</th>
              <th>Team ID</th>
              <th>Team</th>
              <th>Project</th>
              <th>Type</th>
              <th>Owner</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length ? (
              filteredRows.map((r) => {
                const isGMIT = r.institution === 'GMIT';
                return (
                  <tr key={`${r.team_code}-${r.project_title}`}>
                    <td>
                      <span
                        className={`badge-inst ${
                          isGMIT ? 'badge-inst-gmit' : 'badge-inst-gmu'
                        }`}
                      >
                        {r.institution}
                      </span>
                    </td>
                    <td>
                      <span className="badge-sem">Sem {r.semester}</span>
                    </td>
                    <td>
                      {r.sections && r.sections !== '—' ? (
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
                    <td style={{ fontWeight: 600 }}>{r.team_code}</td>
                    <td>{r.team_name}</td>
                    <td style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      {r.project_title}
                    </td>
                    <td>
                      <span
                        className="status"
                        style={{
                          fontSize: '11px',
                          background:
                            r.project_type === 'STUDENT_PROJECT'
                              ? '#eaf4ff'
                              : '#e7f7ef',
                          color:
                            r.project_type === 'STUDENT_PROJECT'
                              ? '#1756a9'
                              : 'var(--green)',
                        }}
                      >
                        {r.project_type === 'STUDENT_PROJECT' ? 'STUDENT' : 'FACULTY'}
                      </span>
                    </td>
                    <td>{r.owner_name}</td>
                    <td>
                      <b>{r.guide_name}</b>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
                  <b>No project allocations match the selected filters.</b>
                  <p style={{ margin: '6px 0 14px' }}>
                    Try clearing one or more filters to view more records.
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
