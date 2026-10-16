'use client';

import React, { useMemo } from 'react';
import type { SectionMeta } from '@/lib/filter-options';

interface FilterBarProps {
  institution: string;
  onInstitutionChange: (val: string) => void;
  semester: string;
  onSemesterChange: (val: string) => void;
  section: string;
  onSectionChange: (val: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  availableInstitutions: string[];
  availableSemesters: number[];
  allSectionMetas: SectionMeta[];
  totalCount: number;
  filteredCount: number;
  itemLabel?: string;
  searchPlaceholder?: string;
  onReset: () => void;
}

export default function FilterBar({
  institution,
  onInstitutionChange,
  semester,
  onSemesterChange,
  section,
  onSectionChange,
  search,
  onSearchChange,
  availableInstitutions,
  availableSemesters,
  allSectionMetas,
  totalCount,
  filteredCount,
  itemLabel = 'items',
  searchPlaceholder = 'Search by name, code, title...',
  onReset,
}: FilterBarProps) {
  // Dynamically compute available sections based on chosen institution and semester
  const dynamicSections = useMemo(() => {
    let list = allSectionMetas;
    if (institution) {
      list = list.filter((s) => s.institution.toLowerCase() === institution.toLowerCase());
    }
    if (semester) {
      list = list.filter((s) => String(s.semester) === String(semester));
    }
    const uniqueCodes = Array.from(new Set(list.map((s) => s.code))).sort();
    return uniqueCodes;
  }, [allSectionMetas, institution, semester]);

  // Handle institution change
  const handleInstitutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextInst = e.target.value;
    onInstitutionChange(nextInst);
    // If current section is no longer valid for the new institution, clear it
    if (section && nextInst) {
      const isValid = allSectionMetas.some(
        (s) =>
          s.code.toLowerCase() === section.toLowerCase() &&
          s.institution.toLowerCase() === nextInst.toLowerCase() &&
          (!semester || String(s.semester) === String(semester))
      );
      if (!isValid) onSectionChange('');
    }
  };

  // Handle semester change
  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSem = e.target.value;
    onSemesterChange(nextSem);
    // If current section is no longer valid for the new semester, clear it
    if (section && nextSem) {
      const isValid = allSectionMetas.some(
        (s) =>
          s.code.toLowerCase() === section.toLowerCase() &&
          String(s.semester) === String(nextSem) &&
          (!institution || s.institution.toLowerCase() === institution.toLowerCase())
      );
      if (!isValid) onSectionChange('');
    }
  };

  const hasActiveFilters = Boolean(institution || semester || section || search);

  return (
    <div className="filter-card">
      <div className="filter-card-header">
        <div className="filter-title">
          <span>🔍</span> Filter &amp; Search Directory
        </div>
        <span className="result-count-badge">
          Showing <b>{filteredCount}</b> of <b>{totalCount}</b> {itemLabel}
        </span>
      </div>

      <div className="filter-grid">
        {/* Institution filter */}
        <div className="filter-field">
          <label htmlFor="filter-institution">Institution</label>
          <select
            id="filter-institution"
            value={institution}
            onChange={handleInstitutionChange}
          >
            <option value="">All Institutions</option>
            {availableInstitutions.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
              </option>
            ))}
          </select>
        </div>

        {/* Semester filter */}
        <div className="filter-field">
          <label htmlFor="filter-sem">Semester</label>
          <select
            id="filter-sem"
            value={semester}
            onChange={handleSemesterChange}
          >
            <option value="">All Semesters</option>
            {availableSemesters.map((sem) => (
              <option key={sem} value={String(sem)}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>

        {/* Section filter */}
        <div className="filter-field">
          <label htmlFor="filter-section">Section</label>
          <select
            id="filter-section"
            value={section}
            onChange={(e) => onSectionChange(e.target.value)}
          >
            <option value="">All Sections</option>
            {dynamicSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>

        {/* Search input */}
        <div className="filter-field" style={{ minWidth: '220px' }}>
          <label htmlFor="filter-search">Search Keyword</label>
          <input
            id="filter-search"
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Active filters pill display and reset */}
      {hasActiveFilters && (
        <div className="filter-actions">
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
            Active Filters:
          </span>

          {institution && (
            <button
              type="button"
              className="filter-pill"
              onClick={() => onInstitutionChange('')}
              title="Remove Institution filter"
            >
              Institution: {institution} <span className="pill-close">×</span>
            </button>
          )}

          {semester && (
            <button
              type="button"
              className="filter-pill"
              onClick={() => onSemesterChange('')}
              title="Remove Semester filter"
            >
              Sem: {semester} <span className="pill-close">×</span>
            </button>
          )}

          {section && (
            <button
              type="button"
              className="filter-pill"
              onClick={() => onSectionChange('')}
              title="Remove Section filter"
            >
              Section: {section} <span className="pill-close">×</span>
            </button>
          )}

          {search && (
            <button
              type="button"
              className="filter-pill"
              onClick={() => onSearchChange('')}
              title="Clear search query"
            >
              Search: &quot;{search}&quot; <span className="pill-close">×</span>
            </button>
          )}

          <button
            type="button"
            className="btn secondary"
            style={{ padding: '4px 10px', fontSize: '12px', marginLeft: 'auto' }}
            onClick={onReset}
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}
