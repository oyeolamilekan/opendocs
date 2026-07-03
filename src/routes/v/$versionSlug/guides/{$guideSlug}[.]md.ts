import { createFileRoute } from "@tanstack/react-router";
import { formatGuideMarkdown } from "../../../../lib/markdown-export";
import {
  loadPublicGuidePage,
  resolvePublicProjectByDomain,
} from "../../../../lib/public-docs";
import { extractProjectSlugFromRequest } from "../../../../lib/public-docs-domain";

export const Route = createFileRoute("/v/$versionSlug/guides/{$guideSlug}.md")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const domainSlug = extractProjectSlugFromRequest(request);
          if (!domainSlug) throw new Error("Documentation not found");
          const identity = await resolvePublicProjectByDomain(domainSlug);
          if (!identity) throw new Error("Documentation not found");

          const data = await loadPublicGuidePage(
            identity.organizationSlug,
            identity.projectSlug,
            params.guideSlug,
            params.versionSlug,
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
