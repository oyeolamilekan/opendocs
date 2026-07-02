import { createFileRoute } from "@tanstack/react-router";
import { formatLlmsTxt } from "../../../../lib/llms-text";
import { loadPublicDocumentationExport } from "../../../../lib/public-docs";
import { buildPublicDocumentationUrl } from "../../../../lib/public-docs-domain";

export const Route = createFileRoute(
  "/docs/$organizationSlug/$projectSlug/llms.txt",
)({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const data = await loadPublicDocumentationExport(
            params.organizationSlug,
            params.projectSlug,
          );
          const text = formatLlmsTxt({
            project: data.project,
            guides: data.guides,
            sections: data.sections,
            publicBaseUrl: publicProjectBaseUrl(request, params),
          });

          return textResponse(text);
        } catch {
          return textResponse("Documentation not found.\n", 404);
        }
      },
    },
  },
});

function publicProjectBaseUrl(
  request: Request,
  params: { organizationSlug: string; projectSlug: string },
) {
  const url = new URL(request.url);
  return buildPublicDocumentationUrl({
    projectSlug: params.projectSlug,
    protocol: url.protocol.replace(":", ""),
    host: url.host,
  });
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
