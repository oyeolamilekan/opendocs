import { createFileRoute } from "@tanstack/react-router";
import { searchPublicDocumentation } from "../../../../lib/agent-export";
import { jsonResponse } from "../../../../lib/agent-route-utils";
import { loadPublicRetrievalRequest } from "../../../../lib/public-retrieval-api";

export const Route = createFileRoute("/api/public/docs/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const query = url.searchParams.get("q")?.trim();
          if (!query) return jsonResponse({ error: "Missing q query" }, 400);
          if (query.length > 300) {
            return jsonResponse({ error: "Query is too long" }, 400);
          }

          const limit = Number(url.searchParams.get("limit") ?? 10);
          const { data, urls, versionSlug } =
            await loadPublicRetrievalRequest(request);

          return jsonResponse({
            project: data.project.project,
            versionSlug: versionSlug ?? null,
            results: searchPublicDocumentation({
              data,
              urls,
              query,
              limit: Number.isFinite(limit) ? limit : 10,
            }),
          });
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
