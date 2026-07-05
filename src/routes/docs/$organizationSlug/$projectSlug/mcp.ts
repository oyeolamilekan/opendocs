import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "../../../../lib/agent-route-utils";
import { loadHostedMcpContext } from "../../../../lib/mcp-route-context";
import { handleMcpHttpRequest } from "../../../../lib/mcp-server";

export const Route = createFileRoute("/docs/$organizationSlug/$projectSlug/mcp")(
  {
    server: {
      handlers: {
        POST: async ({ params, request }) => {
          try {
            const context = await loadHostedMcpContext({ request, ...params });
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
  },
);
