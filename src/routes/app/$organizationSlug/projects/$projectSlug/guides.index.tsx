import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditor } from "../../../../../components/project-editor";
import { WorkspaceShell } from "../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/guides/",
)({
  component: GuidesRoute,
});

function GuidesRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectEditor
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
          area="guides"
        />
      )}
    </WorkspaceShell>
  );
}
