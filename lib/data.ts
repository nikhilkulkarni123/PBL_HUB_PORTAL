import { query } from './db';
export type Project = {
  id: number;
  project_code: string;
  title: string;
  short_description: string;
  description: string;
  domain: string;
  technology_stack: string;
  status: string;
  max_teams: number;
  allocated_count: number;
  owner_name: string;
  guide_name: string;
  semester: number;
  institution: string;
  sections: string;
  project_type: string;
  application_mode: string;
};

export async function listProjects(): Promise<Project[]> {
  return query<Project>(`
    SELECT 
      p.id,
      p.project_code,
      p.title,
      COALESCE(p.short_description, '') AS short_description,
      COALESCE(p.description, '') AS description,
      COALESCE(p.domain, '') AS domain,
      COALESCE(p.technology_stack, '') AS technology_stack,
      p.status,
      p.max_teams,
      COUNT(DISTINCT pa.id) FILTER(WHERE pa.status = 'ACTIVE')::int AS allocated_count,
      COALESCE(of.name, t.team_name) AS owner_name,
      COALESCE(g.name, 'Guide pending') AS guide_name,
      pc.semester,
      CASE WHEN prog.code LIKE 'GMIT%' THEN 'GMIT' ELSE 'GMU' END AS institution,
      COALESCE(STRING_AGG(DISTINCT se.code, ', ' ORDER BY se.code), 'All Sections') AS sections,
      p.project_type,
      p.application_mode
    FROM projects_v2 p
    JOIN pbl_cycles_v2 pc ON pc.id = p.pbl_cycle_id
    JOIN programs_v2 prog ON prog.id = pc.program_id
    LEFT JOIN faculty_v2 of ON of.id = p.owner_faculty_id
    LEFT JOIN teams_v2 t ON t.id = p.owner_team_id
    LEFT JOIN faculty_v2 g ON g.id = p.guide_faculty_id
    LEFT JOIN project_allocations_v2 pa ON pa.project_id = p.id AND pa.status = 'ACTIVE'
    LEFT JOIN teams_v2 at ON at.id = pa.team_id
    LEFT JOIN team_members_v2 tm ON tm.team_id = t.id OR tm.team_id = at.id
    LEFT JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
    LEFT JOIN sections_v2 se ON se.id = e.section_id
    WHERE p.visibility = 'PUBLIC' AND p.status <> 'DRAFT'
    GROUP BY p.id, of.name, t.team_name, g.name, pc.semester, prog.code
    ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
  `);
}

export async function getProject(id: number) {
  return (
    await query<Project>(`
      SELECT 
        p.id,
        p.project_code,
        p.title,
        COALESCE(p.short_description, '') AS short_description,
        COALESCE(p.description, '') AS description,
        COALESCE(p.domain, '') AS domain,
        COALESCE(p.technology_stack, '') AS technology_stack,
        p.status,
        p.max_teams,
        COUNT(DISTINCT pa.id) FILTER(WHERE pa.status = 'ACTIVE')::int AS allocated_count,
        COALESCE(of.name, t.team_name) AS owner_name,
        COALESCE(g.name, 'Guide pending') AS guide_name,
        pc.semester,
        CASE WHEN prog.code LIKE 'GMIT%' THEN 'GMIT' ELSE 'GMU' END AS institution,
        COALESCE(STRING_AGG(DISTINCT se.code, ', ' ORDER BY se.code), 'All Sections') AS sections,
        p.project_type,
        p.application_mode
      FROM projects_v2 p
      JOIN pbl_cycles_v2 pc ON pc.id = p.pbl_cycle_id
      JOIN programs_v2 prog ON prog.id = pc.program_id
      LEFT JOIN faculty_v2 of ON of.id = p.owner_faculty_id
      LEFT JOIN teams_v2 t ON t.id = p.owner_team_id
      LEFT JOIN faculty_v2 g ON g.id = p.guide_faculty_id
      LEFT JOIN project_allocations_v2 pa ON pa.project_id = p.id AND pa.status = 'ACTIVE'
      LEFT JOIN teams_v2 at ON at.id = pa.team_id
      LEFT JOIN team_members_v2 tm ON tm.team_id = t.id OR tm.team_id = at.id
      LEFT JOIN student_enrollments_v2 e ON e.id = tm.enrollment_id
      LEFT JOIN sections_v2 se ON se.id = e.section_id
      WHERE p.id = $1
      GROUP BY p.id, of.name, t.team_name, g.name, pc.semester, prog.code
    `, [id])
  )[0];
}

