import { createFileRoute } from "@tanstack/react-router";
import { generateOpenApiDocument } from "../lib/openapi-export";
import {
  loadPublicDocumentationExport,
  resolvePublicProjectByDomain,
} from "../lib/public-docs";
import { extractProjectSlugFromRequest } from "../lib/public-docs-domain";

export const Route = createFileRoute("/openapi.json")({
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

          return jsonResponse(
            generateOpenApiDocument({
              project: data.project,
              sections: data.sections,
            }),
          );
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
