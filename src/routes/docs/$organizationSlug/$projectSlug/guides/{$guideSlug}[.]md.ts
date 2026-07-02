import { createFileRoute } from "@tanstack/react-router";
import { formatGuideMarkdown } from "../../../../../lib/markdown-export";
import { loadPublicGuidePage } from "../../../../../lib/public-docs";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/guides/{$guideSlug}.md",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const data = await loadPublicGuidePage(
            params.organizationSlug,
            params.projectSlug,
            params.guideSlug,
          );

          return markdownResponse(
            formatGuideMarkdown({ guide: data.guidePage }),
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
