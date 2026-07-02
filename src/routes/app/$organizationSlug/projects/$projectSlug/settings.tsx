import { createFileRoute } from "@tanstack/react-router";
import { ProjectSettingsPage } from "../../../../../components/project-settings-page";
import { WorkspaceShell } from "../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/settings",
)({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectSettingsPage
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
        />
      )}
    </WorkspaceShell>
  );
}
