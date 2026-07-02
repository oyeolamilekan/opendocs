import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditor } from "../../../../components/project-editor";
import { WorkspaceShell } from "../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/",
)({
  component: ProjectRoute,
});

function ProjectRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectEditor
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
        />
      )}
    </WorkspaceShell>
  );
}
