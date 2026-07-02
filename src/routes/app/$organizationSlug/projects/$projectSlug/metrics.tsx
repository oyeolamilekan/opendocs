import { createFileRoute } from "@tanstack/react-router";
import { ProjectMetricsPage } from "../../../../../components/project-metrics-page";
import { WorkspaceShell } from "../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/metrics",
)({
  component: MetricsRoute,
});

function MetricsRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectMetricsPage
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
        />
      )}
    </WorkspaceShell>
  );
}
