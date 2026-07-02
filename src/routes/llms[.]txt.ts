import { createFileRoute } from "@tanstack/react-router";
import { formatLlmsTxt } from "../lib/llms-text";
import {
  loadPublicDocumentationExport,
  resolvePublicProjectByDomain,
} from "../lib/public-docs";
import { extractProjectSlugFromRequest } from "../lib/public-docs-domain";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const domainSlug = extractProjectSlugFromRequest(request);
          if (!domainSlug) throw new Error("Documentation not found");
          const identity = await resolvePublicProjectByDomain(domainSlug);
          if (!identity) throw new Error("Documentation not found");
          const data = await loadPublicDocumentationExport(
            identity.organizationSlug,
            identity.projectSlug,
          );
          const url = new URL(request.url);
          const text = formatLlmsTxt({
            project: data.project,
            guides: data.guides,
            sections: data.sections,
            publicBaseUrl: url.origin,
          });

          return textResponse(text);
        } catch {
          return textResponse("Documentation not found.\n", 404);
        }
      },
    },
  },
});

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
