import { createFileRoute } from "@tanstack/react-router";
import { formatEndpointMarkdown } from "../../../../lib/markdown-export";
import { loadPublicEndpoint } from "../../../../lib/public-docs";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/{$endpointSlug}.md",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const data = await loadPublicEndpoint(
            params.organizationSlug,
            params.projectSlug,
            params.endpointSlug,
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
