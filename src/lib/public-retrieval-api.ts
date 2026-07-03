import type { AgentExportUrls, DocumentationExportData } from "./agent-export";
import {
  customDomainAgentExportUrls,
  hostedAgentExportUrls,
} from "./agent-route-utils";
import {
  loadPublicDocumentationExport,
  resolvePublicProjectByDomain,
} from "./public-docs";
import { extractProjectSlugFromRequest } from "./public-docs-domain";

export async function loadPublicRetrievalRequest(request: Request): Promise<{
  data: DocumentationExportData;
  urls: AgentExportUrls;
  versionSlug?: string;
}> {
  const url = new URL(request.url);
  const organizationSlug = url.searchParams.get("organizationSlug")?.trim();
  const projectSlug = url.searchParams.get("projectSlug")?.trim();
  const versionSlug = url.searchParams.get("versionSlug")?.trim() || undefined;

  if (organizationSlug || projectSlug) {
    if (!organizationSlug || !projectSlug) {
      throw new Error("organizationSlug and projectSlug are both required");
    }
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
  }

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
}
