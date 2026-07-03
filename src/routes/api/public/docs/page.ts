import { createFileRoute } from "@tanstack/react-router";
import { getPublicDocumentationPage } from "../../../../lib/agent-export";
import { jsonResponse } from "../../../../lib/agent-route-utils";
import { loadPublicRetrievalRequest } from "../../../../lib/public-retrieval-api";

export const Route = createFileRoute("/api/public/docs/page")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const type = url.searchParams.get("type");
          const slug = url.searchParams.get("slug")?.trim();
          if (type !== "guide" && type !== "reference") {
            return jsonResponse(
              { error: "type must be guide or reference" },
              400,
            );
          }
          if (!slug) return jsonResponse({ error: "Missing slug query" }, 400);

          const { data, urls } = await loadPublicRetrievalRequest(request);
          const page = getPublicDocumentationPage({ data, urls, type, slug });
          if (!page) return jsonResponse({ error: "Page not found" }, 404);

          return jsonResponse(page);
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
