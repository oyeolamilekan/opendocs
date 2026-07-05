import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "../../../../../lib/agent-route-utils";
import { loadHostedMcpContext } from "../../../../../lib/mcp-route-context";
import { generateMcpDiscovery } from "../../../../../lib/mcp-server";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/.well-known/mcp.json",
)({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          return jsonResponse(
            generateMcpDiscovery(
              await loadHostedMcpContext({ request, ...params }),
            ),
          );
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
