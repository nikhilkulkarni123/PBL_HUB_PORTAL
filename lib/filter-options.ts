import { query } from './db';

export interface SectionMeta {
  code: string;
  semester: number;
  institution: string;
}

export interface DirectoryFilterMeta {
  institutions: string[];
  semesters: number[];
  sections: SectionMeta[];
}

export async function getDirectoryFilterMeta(): Promise<DirectoryFilterMeta> {
  const sections = await query<SectionMeta>(`
    SELECT DISTINCT 
      s.code, 
      s.semester, 
      CASE WHEN p.code LIKE 'GMIT%' THEN 'GMIT' ELSE 'GMU' END as institution
    FROM sections_v2 s
    JOIN programs_v2 p ON p.id = s.program_id
    ORDER BY institution, s.semester, s.code
  `);

  const instSet = new Set<string>();
  const semSet = new Set<number>();

  for (const s of sections) {
    if (s.institution) instSet.add(s.institution);
    if (s.semester) semSet.add(s.semester);
  }

  return {
    institutions: Array.from(instSet).sort(),
    semesters: Array.from(semSet).sort((a, b) => a - b),
    sections,
  };
}
