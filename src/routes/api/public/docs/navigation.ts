import { createFileRoute } from "@tanstack/react-router";
import { getPublicNavigationTree } from "../../../../lib/agent-export";
import { jsonResponse } from "../../../../lib/agent-route-utils";
import { loadPublicRetrievalRequest } from "../../../../lib/public-retrieval-api";

export const Route = createFileRoute("/api/public/docs/navigation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { data, urls, versionSlug } =
            await loadPublicRetrievalRequest(request);

          return jsonResponse(
            getPublicNavigationTree({ data, urls, versionSlug }),
          );
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
