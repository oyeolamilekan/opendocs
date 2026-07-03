import { createFileRoute } from "@tanstack/react-router";
import { getPublicEndpointSchema } from "../../../../lib/agent-export";
import { jsonResponse } from "../../../../lib/agent-route-utils";
import { loadPublicRetrievalRequest } from "../../../../lib/public-retrieval-api";

export const Route = createFileRoute("/api/public/docs/endpoint")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const slug = url.searchParams.get("slug")?.trim();
          const id =
            url.searchParams.get("operationId")?.trim() ||
            url.searchParams.get("id")?.trim() ||
            undefined;
          if (!slug && !id) {
            return jsonResponse(
              { error: "Missing slug or operationId query" },
              400,
            );
          }

          const { data, urls } = await loadPublicRetrievalRequest(request);
          const endpoint = getPublicEndpointSchema({ data, urls, slug, id });
          if (!endpoint) {
            return jsonResponse({ error: "Endpoint not found" }, 404);
          }

          return jsonResponse(endpoint);
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
