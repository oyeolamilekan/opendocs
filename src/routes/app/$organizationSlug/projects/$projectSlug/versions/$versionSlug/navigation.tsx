import { createFileRoute } from "@tanstack/react-router";
import { ProjectNavigationPage } from "../../../../../../../components/project-navigation-page";
import { WorkspaceShell } from "../../../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/navigation",
)({
  component: NavigationRoute,
});

function NavigationRoute() {
  const { organizationSlug, projectSlug, versionSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectNavigationPage
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
          versionSlug={versionSlug}
        />
      )}
    </WorkspaceShell>
  );
}
