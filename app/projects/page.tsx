import { listProjects } from '@/lib/data';
import { getDirectoryFilterMeta } from '@/lib/filter-options';
import ProjectsDirectory from '@/components/ProjectsDirectory';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    institution?: string;
    sem?: string;
    section?: string;
    q?: string;
  }>;
}) {
  const params = searchParams ? await searchParams : {};

  const [projects, filterMeta] = await Promise.all([
    listProjects(),
    getDirectoryFilterMeta(),
  ]);

  return (
    <section className="section">
      <div className="container">
        <h1>Explore Project Ideas</h1>
        <p className="lead">
          Faculty projects are open to eligible teams. Student-initiated projects are visible for transparency but reserved for their owning team. Filter by Institution, Semester, and Section.
        </p>

        <ProjectsDirectory
          initialProjects={projects}
          filterMeta={filterMeta}
          initialParams={params}
        />
      </div>
    </section>
  );
}
