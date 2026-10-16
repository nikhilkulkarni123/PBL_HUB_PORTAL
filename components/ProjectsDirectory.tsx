'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import FilterBar from './FilterBar';
import type { Project } from '@/lib/data';
import type { DirectoryFilterMeta } from '@/lib/filter-options';

interface ProjectsDirectoryProps {
  initialProjects: Project[];
  filterMeta: DirectoryFilterMeta;
  initialParams?: {
    institution?: string;
    sem?: string;
    section?: string;
    q?: string;
  };
}

export default function ProjectsDirectory({
  initialProjects,
  filterMeta,
  initialParams,
}: ProjectsDirectoryProps) {
  const [institution, setInstitution] = useState(initialParams?.institution || '');
  const [semester, setSemester] = useState(initialParams?.sem || '');
  const [section, setSection] = useState(initialParams?.section || '');
  const [search, setSearch] = useState(initialParams?.q || '');
  const [includeOpenFacultyProjects, setIncludeOpenFacultyProjects] = useState(true);

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
    setIncludeOpenFacultyProjects(true);
  };

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((p) => {
      if (institution && p.institution.toLowerCase() !== institution.toLowerCase()) {
        return false;
      }
      if (semester && String(p.semester) !== semester) {
        return false;
      }
      if (section) {
        const itemSections = p.sections
          ? p.sections.split(',').map((s) => s.trim().toLowerCase())
          : [];
        const isDirectMatch = itemSections.includes(section.toLowerCase());
        const isOpenFaculty =
          p.project_type === 'FACULTY_PROJECT' &&
          (p.sections === 'All Sections' || !p.sections);

        if (includeOpenFacultyProjects) {
          if (!isDirectMatch && !isOpenFaculty) {
            return false;
          }
        } else {
          if (!isDirectMatch) {
            return false;
          }
        }
      }
      if (search) {
        const query = search.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(query);
        const matchDesc = (p.short_description || '').toLowerCase().includes(query);
        const matchDomain = (p.domain || '').toLowerCase().includes(query);
        const matchTech = (p.technology_stack || '').toLowerCase().includes(query);
        const matchOwner = (p.owner_name || '').toLowerCase().includes(query);
        const matchGuide = (p.guide_name || '').toLowerCase().includes(query);
        const matchCode = (p.project_code || '').toLowerCase().includes(query);
        if (
          !matchTitle &&
          !matchDesc &&
          !matchDomain &&
          !matchTech &&
          !matchOwner &&
          !matchGuide &&
          !matchCode
        ) {
          return false;
        }
      }
      return true;
    });
  }, [initialProjects, institution, semester, section, search, includeOpenFacultyProjects]);

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
        totalCount={initialProjects.length}
        filteredCount={filteredProjects.length}
        itemLabel="projects"
        searchPlaceholder="Search title, domain, technology, guide..."
        onReset={handleReset}
      />

      {section && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--muted)',
          }}
        >
          <input
            id="include-faculty-toggle"
            type="checkbox"
            checked={includeOpenFacultyProjects}
            onChange={(e) => setIncludeOpenFacultyProjects(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor="include-faculty-toggle" style={{ cursor: 'pointer' }}>
            Also include open faculty project ideas available to all sections in Semester {semester || '(any)'}
          </label>
        </div>
      )}

      {filteredProjects.length ? (
        <div className="grid">
          {filteredProjects.map((p) => {
            const isGMIT = p.institution === 'GMIT';
            const isStudent = p.project_type === 'STUDENT_PROJECT';
            const isFullyAllocated = p.allocated_count >= p.max_teams;

            return (
              <article
                className="card"
                key={p.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {/* Status and Institution tags */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '8px',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      className="status"
                      style={{
                        background: isStudent ? '#edf4ff' : '#e7f7ef',
                        color: isStudent ? '#1756a9' : 'var(--green)',
                      }}
                    >
                      {isStudent
                        ? 'STUDENT INITIATED — RESERVED'
                        : isFullyAllocated
                        ? 'FULLY ALLOCATED'
                        : p.status}
                    </span>

                    <span
                      className={`badge-inst ${
                        isGMIT ? 'badge-inst-gmit' : 'badge-inst-gmu'
                      }`}
                    >
                      {p.institution}
                    </span>
                  </div>

                  {/* Metadata badges row */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="badge-sem">Sem {p.semester}</span>
                    {p.sections && p.sections !== 'All Sections' ? (
                      p.sections.split(',').map((s) => (
                        <span key={s.trim()} className="badge-sec">
                          Sec {s.trim()}
                        </span>
                      ))
                    ) : (
                      <span
                        className="badge-sec"
                        style={{ background: '#f0f4f8', color: '#486581', borderColor: '#d9e2ec' }}
                      >
                        All Sections
                      </span>
                    )}
                  </div>

                  <h2 style={{ fontSize: '18px', margin: '0 0 10px', lineHeight: '1.35' }}>
                    {p.title}
                  </h2>

                  {p.short_description && (
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--muted)',
                        marginBottom: '14px',
                        lineHeight: '1.5',
                      }}
                    >
                      {p.short_description}
                    </p>
                  )}

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      marginBottom: '14px',
                      lineHeight: '1.6',
                    }}
                  >
                    <div>
                      <b>Owner:</b> {p.owner_name}
                    </div>
                    <div>
                      <b>Guide:</b> {p.guide_name}
                    </div>
                    {p.domain && (
                      <div>
                        <b>Domain:</b> {p.domain}
                      </div>
                    )}
                    {p.technology_stack && (
                      <div style={{ marginTop: '4px' }}>
                        {p.technology_stack
                          .split(',')
                          .filter(Boolean)
                          .map((t) => (
                            <span
                              key={t}
                              className="tag"
                              style={{ fontSize: '11px', padding: '2px 6px' }}
                            >
                              {t.trim()}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isFullyAllocated ? '#b71c1c' : 'var(--muted)',
                      marginBottom: '10px',
                    }}
                  >
                    {p.allocated_count} of {p.max_teams} allocation slot(s) used
                  </div>

                  <Link
                    className="btn"
                    href={`/projects/${p.id}`}
                    style={{ width: '100%', textAlign: 'center' }}
                  >
                    View project
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}
        >
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>💡</div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--navy)' }}>
            No project ideas match the selected filters.
          </h3>
          <p style={{ margin: '0 0 16px' }}>
            Try broadening your selection by resetting Institution, Semester, Section, or your keyword search.
          </p>
          <button type="button" className="btn secondary" onClick={handleReset}>
            Reset Filters
          </button>
        </div>
      )}
    </>
  );
}
