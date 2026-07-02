import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditor } from "../../../../../../components/project-editor";
import { WorkspaceShell } from "../../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/reference/$endpointSlug",
)({
  component: EndpointRoute,
});

function EndpointRoute() {
  const { organizationSlug, projectSlug, endpointSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectEditor
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
          endpointSlug={endpointSlug}
        />
      )}
    </WorkspaceShell>
  );
}
