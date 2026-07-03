import type { AgentExportUrls } from "./agent-export";

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function customDomainAgentExportUrls({
  request,
  versionSlug,
}: {
  request: Request;
  versionSlug?: string;
}): AgentExportUrls {
  const origin = new URL(request.url).origin;
  const encodedVersion = versionSlug
    ? encodeURIComponent(versionSlug)
    : undefined;
  const exportBase = encodedVersion ? `${origin}/v/${encodedVersion}` : origin;
  const pageBase = encodedVersion ? `${origin}/${encodedVersion}` : origin;

  return {
    publicBaseUrl: exportBase,
    apiBaseUrl: origin,
    agentManifestUrl: `${exportBase}/agent.json`,
    toolCatalogUrl: `${exportBase}/tools.json`,
    openapiUrl: `${exportBase}/openapi.json`,
    llmsTxtUrl: `${exportBase}/llms.txt`,
    pageUrlTemplates: {
      guide: `${pageBase}/docs/{slug}`,
      reference: `${pageBase}/reference/{slug}`,
    },
    markdownUrlTemplates: {
      guide: `${exportBase}/guides/{slug}.md`,
      reference: `${exportBase}/reference/{slug}.md`,
    },
    retrievalApi: retrievalApiUrls({
      origin,
      versionSlug,
    }),
  };
}

export function hostedAgentExportUrls({
  request,
  organizationSlug,
  projectSlug,
}: {
  request: Request;
  organizationSlug: string;
  projectSlug: string;
}): AgentExportUrls {
  const origin = new URL(request.url).origin;
  const base = `${origin}/docs/${encodeURIComponent(
    organizationSlug,
  )}/${encodeURIComponent(projectSlug)}`;

  return {
    publicBaseUrl: base,
    apiBaseUrl: origin,
    agentManifestUrl: `${base}/agent.json`,
    toolCatalogUrl: `${base}/tools.json`,
    openapiUrl: `${base}/openapi.json`,
    llmsTxtUrl: `${base}/llms.txt`,
    pageUrlTemplates: {
      guide: `${base}/guides/{slug}`,
      reference: `${base}/{slug}`,
    },
    markdownUrlTemplates: {
      guide: `${base}/guides/{slug}.md`,
      reference: `${base}/{slug}.md`,
    },
    retrievalApi: retrievalApiUrls({
      origin,
      organizationSlug,
      projectSlug,
    }),
  };
}

function retrievalApiUrls({
  origin,
  organizationSlug,
  projectSlug,
  versionSlug,
}: {
  origin: string;
  organizationSlug?: string;
  projectSlug?: string;
  versionSlug?: string;
}) {
  const params = new URLSearchParams();
  if (organizationSlug) params.set("organizationSlug", organizationSlug);
  if (projectSlug) params.set("projectSlug", projectSlug);
  if (versionSlug) params.set("versionSlug", versionSlug);
  const suffix = params.toString();
  const joiner = suffix ? `&${suffix}` : "";
  const query = suffix ? `?${suffix}` : "";
  const base = `${origin}/api/public/docs`;

  return {
    search: `${base}/search?q={query}${joiner}`,
    page: `${base}/page?type={guide|reference}&slug={slug}${joiner}`,
    endpoint: `${base}/endpoint?slug={slug}${joiner}`,
    navigation: `${base}/navigation${query}`,
  };
}
