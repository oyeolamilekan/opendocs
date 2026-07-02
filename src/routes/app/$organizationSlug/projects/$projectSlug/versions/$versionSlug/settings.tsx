import { createFileRoute } from "@tanstack/react-router";
import { ProjectVersionSettingsPage } from "../../../../../../../components/project-editor";
import { WorkspaceShell } from "../../../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/settings",
)({
  component: VersionSettingsRoute,
});

function VersionSettingsRoute() {
  const { organizationSlug, projectSlug, versionSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectVersionSettingsPage
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
          versionSlug={versionSlug}
        />
      )}
    </WorkspaceShell>
  );
}
