import {
  customDomainAgentExportUrls,
  hostedAgentExportUrls,
} from "./agent-route-utils";
import type { McpServerContext } from "./mcp-server";
import {
  loadPublicDocumentationExport,
  resolvePublicProjectByDomain,
} from "./public-docs";
import { extractProjectSlugFromRequest } from "./public-docs-domain";

/**
 * Loads MCP context for a public custom-domain documentation request.
 *
 * @param request - Incoming public documentation request.
 * @param [versionSlug] - Optional documentation version slug.
 * @returns Public MCP server context.
 */
export const loadCustomDomainMcpContext = async (
  request: Request,
  versionSlug?: string,
): Promise<McpServerContext> => {
  const domainSlug = extractProjectSlugFromRequest(request);
  if (!domainSlug) throw new Error("Documentation not found");

  const identity = await resolvePublicProjectByDomain(domainSlug);
  if (!identity) throw new Error("Documentation not found");

  return {
    versionSlug,
    data: await loadPublicDocumentationExport(
      identity.organizationSlug,
      identity.projectSlug,
      versionSlug,
    ),
    urls: customDomainAgentExportUrls({ request, versionSlug }),
  };
};

/**
 * Loads MCP context for the hosted path-based public documentation fallback.
 *
 * @param options - Loader options.
 * @param options.request - Incoming public documentation request.
 * @param options.organizationSlug - Public organization slug.
 * @param options.projectSlug - Public project slug.
 * @param [options.versionSlug] - Optional documentation version slug.
 * @returns Public MCP server context.
 */
export const loadHostedMcpContext = async ({
  request,
  organizationSlug,
  projectSlug,
  versionSlug,
}: {
  request: Request;
  organizationSlug: string;
  projectSlug: string;
  versionSlug?: string;
}): Promise<McpServerContext> => {
  return {
    versionSlug,
    data: await loadPublicDocumentationExport(
      organizationSlug,
      projectSlug,
      versionSlug,
    ),
    urls: hostedAgentExportUrls({
      request,
      organizationSlug,
      projectSlug,
    }),
  };
};
