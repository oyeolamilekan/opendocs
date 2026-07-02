import { createFileRoute } from "@tanstack/react-router";
import { formatLlmsTxt } from "../../../lib/llms-text";
import {
  loadPublicDocumentationExport,
  resolvePublicProjectByDomain,
} from "../../../lib/public-docs";
import {
  buildPublicDocumentationUrl,
  extractProjectSlugFromRequest,
} from "../../../lib/public-docs-domain";

export const Route = createFileRoute("/v/$versionSlug/llms.txt")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const domainSlug = extractProjectSlugFromRequest(request);
          if (!domainSlug) throw new Error("Missing project domain");
          const identity = await resolvePublicProjectByDomain(domainSlug);
          if (!identity) throw new Error("Documentation not found");
          const data = await loadPublicDocumentationExport(
            identity.organizationSlug,
            identity.projectSlug,
            params.versionSlug,
          );
          const text = formatLlmsTxt({
            project: data.project,
            guides: data.guides,
            sections: data.sections,
            publicBaseUrl: publicProjectBaseUrl(request, {
              projectSlug: identity.projectSlug,
              versionSlug: params.versionSlug,
            }),
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
  params: { projectSlug: string; versionSlug: string },
) {
  const url = new URL(request.url);
  return buildPublicDocumentationUrl({
    projectSlug: params.projectSlug,
    path: `/v/${params.versionSlug}`,
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
