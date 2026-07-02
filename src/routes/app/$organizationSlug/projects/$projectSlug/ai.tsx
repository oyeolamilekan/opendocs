import { createFileRoute } from "@tanstack/react-router";
import { ProjectAiPage } from "../../../../../components/project-ai-page";
import { WorkspaceShell } from "../../../../../components/workspace-shell";

export const Route = createFileRoute(
  "/app/$organizationSlug/projects/$projectSlug/ai",
)({
  component: AiRoute,
});

function AiRoute() {
  const { organizationSlug, projectSlug } = Route.useParams();
  return (
    <WorkspaceShell organizationSlug={organizationSlug} layout="none">
      {({ organization, membership }) => (
        <ProjectAiPage
          organization={organization}
          membership={membership}
          projectSlug={projectSlug}
        />
      )}
    </WorkspaceShell>
  );
}
