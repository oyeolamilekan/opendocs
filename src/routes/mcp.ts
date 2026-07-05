import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "../lib/agent-route-utils";
import { handleMcpHttpRequest } from "../lib/mcp-server";
import { loadCustomDomainMcpContext } from "../lib/mcp-route-context";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const context = await loadCustomDomainMcpContext(request);
          return handleMcpHttpRequest({
            request,
            loadContext: async () => context,
          });
        } catch {
          return jsonResponse({ error: "Documentation not found" }, 404);
        }
      },
    },
  },
});
