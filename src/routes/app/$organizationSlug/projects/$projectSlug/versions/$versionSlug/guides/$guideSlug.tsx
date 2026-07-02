import { createFileRoute } from "@tanstack/react-router";
import { ProjectEditor } from "../../../../../../../../components/project-editor";
import { WorkspaceShell } from "../../../../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/guides/$guideSlug",
)({
  component: VersionedGuidePageRoute,
});

function VersionedGuidePageRoute() {
  const {
    organizationSlug,
    projectSlug,
    versionSlug,
    guideSlug,
  } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectEditor
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
          versionSlug={versionSlug}
          guideSlug={guideSlug}
          area="guides"
        />
      )}
    </WorkspaceShell>
  );
}
