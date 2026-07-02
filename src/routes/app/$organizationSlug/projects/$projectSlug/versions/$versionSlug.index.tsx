import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditor } from "../../../../../../components/project-editor";
import { WorkspaceShell } from "../../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/",
)({
  component: VersionedProjectRoute,
});

function VersionedProjectRoute() {
  const { organizationSlug, projectSlug, versionSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectEditor
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
          versionSlug={versionSlug}
        />
      )}
    </WorkspaceShell>
  );
}
