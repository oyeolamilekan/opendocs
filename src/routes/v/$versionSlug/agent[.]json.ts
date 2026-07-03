import { createFileRoute } from "@tanstack/react-router";
import { generateAgentManifest } from "../../../lib/agent-export";
import {
  customDomainAgentExportUrls,
  jsonResponse,
} from "../../../lib/agent-route-utils";
import {
  loadPublicDocumentationExport,
  resolvePublicProjectByDomain,
} from "../../../lib/public-docs";
import { extractProjectSlugFromRequest } from "../../../lib/public-docs-domain";

export const Route = createFileRoute("/v/$versionSlug/agent.json")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const domainSlug = extractProjectSlugFromRequest(request);
          if (!domainSlug) throw new Error("Missing project domain");
          const identity = await resolvePublicProjectByDomain(domainSlug);
          if (!identity) throw new Error("Documentation not found");
          const data = await loadPublicDocumentationExport(
            identity.organizationSlug,
            identity.projectSlug,
            params.versionSlug,
          );

          return jsonResponse(
            generateAgentManifest({
              data,
              versionSlug: params.versionSlug,
              urls: customDomainAgentExportUrls({
                request,
                versionSlug: params.versionSlug,
              }),
            }),
          );
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
