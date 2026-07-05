import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "../../lib/agent-route-utils";
import { loadCustomDomainMcpContext } from "../../lib/mcp-route-context";
import { generateMcpDiscovery } from "../../lib/mcp-server";

export const Route = createFileRoute("/.well-known/mcp.json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return jsonResponse(
            generateMcpDiscovery(await loadCustomDomainMcpContext(request)),
          );
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
