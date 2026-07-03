import { createFileRoute } from "@tanstack/react-router";
import { generateAgentManifest } from "../../../../lib/agent-export";
import {
  hostedAgentExportUrls,
  jsonResponse,
} from "../../../../lib/agent-route-utils";
import { loadPublicDocumentationExport } from "../../../../lib/public-docs";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/agent.json",
)({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const data = await loadPublicDocumentationExport(
            params.organizationSlug,
            params.projectSlug,
          );

          return jsonResponse(
            generateAgentManifest({
              data,
              urls: hostedAgentExportUrls({ request, ...params }),
            }),
          );
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
