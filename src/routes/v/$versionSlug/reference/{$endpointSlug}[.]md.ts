import { createFileRoute } from "@tanstack/react-router";
import { formatEndpointMarkdown } from "../../../../lib/markdown-export";
import {
  loadPublicEndpoint,
  resolvePublicProjectByDomain,
} from "../../../../lib/public-docs";
import { extractProjectSlugFromRequest } from "../../../../lib/public-docs-domain";

export const Route = createFileRoute(
  "/v/$versionSlug/reference/{$endpointSlug}.md",
)({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const domainSlug = extractProjectSlugFromRequest(request);
          if (!domainSlug) throw new Error("Documentation not found");
          const identity = await resolvePublicProjectByDomain(domainSlug);
          if (!identity) throw new Error("Documentation not found");

          const data = await loadPublicEndpoint(
            identity.organizationSlug,
            identity.projectSlug,
            params.endpointSlug,
            params.versionSlug,
          );

          return markdownResponse(
            formatEndpointMarkdown({
              endpoint: data.endpoint,
              baseUrl: data.project.project.baseUrl,
            }),
          );
        } catch {
          return markdownResponse("# Documentation not found\n", 404);
        }
      },
    },
  },
});

function markdownResponse(markdown: string, status = 200) {
  return new Response(markdown, {
    status,
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "content-type": "text/markdown; charset=utf-8",
    },
  });
}
