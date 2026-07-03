import {
  contentToMarkdown,
  formatEndpointMarkdown,
  formatGuideMarkdown,
  type ExportEndpoint,
  type ExportField,
} from "./markdown-export";
import type { LlmsGuideSection } from "./llms-text";
import {
  objectSchema,
  operationId,
  parseResponseExample,
  type OpenApiExportProject,
  type OpenApiExportSection,
} from "./openapi-export";
import { buildRequestUrl, generateCodeExamples } from "./public-docs";

export type PublicDocumentationVersion = {
  name: string;
  slug: string;
  status: "draft" | "published";
  isDefault: boolean;
  isBeta?: boolean;
  isDeprecated?: boolean;
  updatedAt: number;
};

export type DocumentationExportData = {
  project: OpenApiExportProject;
  sections: OpenApiExportSection[];
  guides: LlmsGuideSection[];
  versions?: PublicDocumentationVersion[];
};

export type AgentExportUrls = {
  publicBaseUrl: string;
  apiBaseUrl?: string;
  agentManifestUrl?: string;
  toolCatalogUrl?: string;
  openapiUrl?: string;
  llmsTxtUrl?: string;
  pageUrlTemplates: {
    guide: string;
    reference: string;
  };
  markdownUrlTemplates: {
    guide: string;
    reference: string;
  };
  retrievalApi?: {
    search: string;
    page: string;
    endpoint: string;
    navigation: string;
  };
};

const AGENT_SCHEMA_VERSION = "1.0";
const MAX_SEARCH_RESULTS = 10;

export function generateAgentManifest({
  data,
  urls,
  versionSlug,
}: {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  versionSlug?: string;
}) {
  const versions = publicVersions(data.versions);
  const defaultVersion = versions.find((version) => version.isDefault) ?? null;
  const currentVersion =
    selectedVersion(versions, versionSlug) ?? defaultVersion ?? null;
  const operations = documentedEndpoints(data.sections);
  const readiness = agentReadiness(data);

  return {
    schemaVersion: AGENT_SCHEMA_VERSION,
    name: "Minialdoc Agent Manifest",
    project: projectMetadata(data.project),
    version: currentVersion ? versionMetadata(currentVersion) : null,
    defaultVersion: defaultVersion ? versionMetadata(defaultVersion) : null,
    versions: versions.map(versionMetadata),
    documentation: {
      baseUrl: trimTrailingSlash(urls.publicBaseUrl),
      agentManifestUrl: urls.agentManifestUrl ?? url(urls.publicBaseUrl, "/agent.json"),
      toolCatalogUrl: urls.toolCatalogUrl ?? url(urls.publicBaseUrl, "/tools.json"),
      openapiUrl: urls.openapiUrl ?? url(urls.publicBaseUrl, "/openapi.json"),
      llmsTxtUrl: urls.llmsTxtUrl ?? url(urls.publicBaseUrl, "/llms.txt"),
      pages: {
        guides: urls.pageUrlTemplates.guide,
        reference: urls.pageUrlTemplates.reference,
      },
      markdownExports: {
        guides: urls.markdownUrlTemplates.guide,
        reference: urls.markdownUrlTemplates.reference,
      },
    },
    auth: {
      readOnlyDocs: {
        required: false,
        type: "none",
        notes: "Public documentation retrieval requires no credentials.",
      },
      documentedApiAuth: collectAuthRequirements(operations),
    },
    capabilities: {
      searchDocs: Boolean(urls.retrievalApi?.search),
      getDocPage: Boolean(urls.retrievalApi?.page),
      listEndpoints: true,
      getEndpointSchema: true,
      executeEndpoint: {
        available: false,
        requiresExplicitProjectOptIn: true,
        notes:
          "Live endpoint execution is intentionally not advertised through the agent manifest because it can call external APIs.",
      },
    },
    retrievalApi: urls.retrievalApi ?? null,
    rateLimits: {
      notes:
        "Public JSON exports are cacheable for 60 seconds with stale revalidation. Additional deployment or gateway limits may apply.",
    },
    safeExecution: {
      readOnly: true,
      mutatesExternalSystems: false,
      credentialStorage: "No stored API credential values are exposed.",
    },
    counts: {
      guides: data.guides.reduce((count, section) => count + section.pages.length, 0),
      referencePages: data.sections.reduce(
        (count, section) => count + section.endpoints.length,
        0,
      ),
      operations: operations.length,
    },
    agentReadiness: readiness,
    updatedAt: latestUpdatedAt(data),
  };
}

export function generateToolCatalog({
  data,
  urls,
  versionSlug,
}: {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  versionSlug?: string;
}) {
  const versions = publicVersions(data.versions);
  const currentVersion = selectedVersion(versions, versionSlug);
  const operations = data.sections.flatMap((section) =>
    section.endpoints
      .filter((endpoint) => endpoint.endpointType === "endpoint")
      .map((endpoint) =>
        toolOperation({
          endpoint,
          sectionTitle: section.title,
          urls,
          apiBaseUrl: data.project.project.baseUrl,
        }),
      ),
  );

  return {
    schemaVersion: AGENT_SCHEMA_VERSION,
    project: projectMetadata(data.project),
    version: currentVersion ? versionMetadata(currentVersion) : null,
    openapiUrl: urls.openapiUrl ?? url(urls.publicBaseUrl, "/openapi.json"),
    operations,
    updatedAt: latestUpdatedAt(data),
  };
}

export function searchPublicDocumentation({
  data,
  urls,
  query,
  limit = MAX_SEARCH_RESULTS,
}: {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  query: string;
  limit?: number;
}) {
  const normalizedQuery = query.trim();
  const boundedLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_RESULTS);

  return documentationEntries(data, urls)
    .map((entry) => ({
      entry,
      score: scoreText(normalizedQuery, entry.searchableText),
    }))
    .filter(({ score }) => score > 0 || !normalizedQuery)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.entry.title.localeCompare(right.entry.title),
    )
    .slice(0, boundedLimit)
    .map(({ entry, score }) => ({
      title: entry.title,
      section: entry.section,
      type: entry.type,
      slug: entry.slug,
      description: entry.description,
      method: entry.method,
      path: entry.path,
      url: entry.url,
      markdownUrl: entry.markdownUrl,
      score,
    }));
}

export function getPublicDocumentationPage({
  data,
  urls,
  type,
  slug,
}: {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  type: "guide" | "reference";
  slug: string;
}) {
  if (type === "guide") {
    for (const section of data.guides) {
      const page = section.pages.find((candidate) => candidate.slug === slug);
      if (!page) continue;

      return {
        type,
        slug: page.slug,
        title: page.title,
        section: section.title,
        description: page.description,
        url: fillSlug(urls.pageUrlTemplates.guide, page.slug),
        markdownUrl: fillSlug(urls.markdownUrlTemplates.guide, page.slug),
        markdown: formatGuideMarkdown({ guide: page }),
      };
    }
    return null;
  }

  for (const section of data.sections) {
    const endpoint = section.endpoints.find(
      (candidate) => candidate.slug === slug,
    );
    if (!endpoint) continue;

    return {
      type,
      slug: endpoint.slug,
      title: endpoint.title,
      section: section.title,
      description: endpoint.body.description,
      endpointType: endpoint.endpointType,
      method:
        endpoint.endpointType === "endpoint" ? endpoint.body.method : undefined,
      path:
        endpoint.endpointType === "endpoint" ? endpoint.body.path : undefined,
      url: fillSlug(urls.pageUrlTemplates.reference, endpoint.slug),
      markdownUrl: fillSlug(urls.markdownUrlTemplates.reference, endpoint.slug),
      markdown: formatEndpointMarkdown({
        endpoint,
        baseUrl: data.project.project.baseUrl,
      }),
      operation:
        endpoint.endpointType === "endpoint"
          ? toolOperation({
              endpoint,
              sectionTitle: section.title,
              urls,
              apiBaseUrl: data.project.project.baseUrl,
            })
          : null,
    };
  }

  return null;
}

export function getPublicEndpointSchema({
  data,
  urls,
  slug,
  id,
}: {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  slug?: string;
  id?: string;
}) {
  for (const section of data.sections) {
    const endpoint = section.endpoints.find((candidate) => {
      if (candidate.endpointType !== "endpoint") return false;
      if (slug && candidate.slug === slug) return true;
      if (id && operationId(candidate) === id) return true;
      return false;
    });
    if (!endpoint) continue;

    return toolOperation({
      endpoint,
      sectionTitle: section.title,
      urls,
      apiBaseUrl: data.project.project.baseUrl,
    });
  }

  return null;
}

export function getPublicNavigationTree({
  data,
  urls,
  versionSlug,
}: {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  versionSlug?: string;
}) {
  const versions = publicVersions(data.versions);
  const currentVersion = selectedVersion(versions, versionSlug);

  return {
    project: projectMetadata(data.project),
    version: currentVersion ? versionMetadata(currentVersion) : null,
    versions: versions.map(versionMetadata),
    guides: data.guides.map((section) => ({
      title: section.title,
      slug: section.slug,
      position: section.position,
      pages: section.pages.map((page) => ({
        title: page.title,
        slug: page.slug,
        description: page.description,
        url: fillSlug(urls.pageUrlTemplates.guide, page.slug),
        markdownUrl: fillSlug(urls.markdownUrlTemplates.guide, page.slug),
      })),
    })),
    reference: data.sections.map((section) => ({
      title: section.title,
      slug: section.slug,
      position: section.position,
      pages: section.endpoints.map((endpoint) => ({
        title: endpoint.title,
        slug: endpoint.slug,
        endpointType: endpoint.endpointType,
        method:
          endpoint.endpointType === "endpoint"
            ? endpoint.body.method
            : undefined,
        path:
          endpoint.endpointType === "endpoint" ? endpoint.body.path : undefined,
        description: endpoint.body.description,
        operationId:
          endpoint.endpointType === "endpoint" ? operationId(endpoint) : undefined,
        url: fillSlug(urls.pageUrlTemplates.reference, endpoint.slug),
        markdownUrl: fillSlug(
          urls.markdownUrlTemplates.reference,
          endpoint.slug,
        ),
      })),
    })),
  };
}

function toolOperation({
  endpoint,
  sectionTitle,
  urls,
  apiBaseUrl,
}: {
  endpoint: ExportEndpoint;
  sectionTitle: string;
  urls: AgentExportUrls;
  apiBaseUrl: string;
}) {
  const requiredParameterValues: Record<string, string> = Object.fromEntries(
    endpoint.body.parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => [
        parameter.name,
        String(placeholderForField(parameter)),
      ]),
  );
  const urlParameterValues: Record<string, string> = Object.fromEntries(
    endpoint.body.parameters
      .filter(
        (parameter) =>
          parameter.required &&
          (parameter.location === "path" ||
            parameter.location === "query" ||
            parameter.location === undefined),
      )
      .map((parameter) => [
        parameter.name,
        String(placeholderForField(parameter)),
      ]),
  );
  const requestUrl = buildRequestUrl(
    apiBaseUrl,
    endpoint.body.path,
    endpoint.body.parameters
      .filter(
        (parameter) =>
          parameter.location === "path" ||
          parameter.location === "query" ||
          parameter.location === undefined,
      )
      .map((parameter) => ({
        name: parameter.name,
        location: parameter.location ?? "query",
      })),
    urlParameterValues,
  );
  const requestBodyValues = sampleObjectFromFields(endpoint.body.requestBody);
  const examples = generateCodeExamples({
    method: endpoint.body.method,
    url: requestUrl,
    authType: endpoint.body.authHeader.type,
    authKey: endpoint.body.authHeader.key,
    hasBody: endpoint.body.requestBody.length > 0,
    bodyValues: requestBodyValues,
  });
  const auth = authMetadata(endpoint.body.authHeader);

  return {
    operationId: operationId(endpoint),
    title: endpoint.title,
    slug: endpoint.slug,
    section: sectionTitle,
    method: endpoint.body.method,
    path: endpoint.body.path,
    description: endpoint.body.description,
    docsUrl: fillSlug(urls.pageUrlTemplates.reference, endpoint.slug),
    markdownUrl: fillSlug(urls.markdownUrlTemplates.reference, endpoint.slug),
    auth,
    parameters: endpoint.body.parameters.map(parameterMetadata),
    requestBody: endpoint.body.requestBody.length
      ? {
          contentType: "application/json",
          required: endpoint.body.requestBody.some((field) => field.required),
          schema: objectSchema(endpoint.body.requestBody),
          fields: endpoint.body.requestBody.map(fieldMetadata),
        }
      : null,
    responses: endpoint.body.sampleResponses.map((response) => ({
      statusCode: response.statusCode,
      description: response.description,
      example: response.body ? parseResponseExample(response.body) : undefined,
    })),
    validation: {
      requiredParameters: endpoint.body.parameters
        .filter((parameter) => parameter.required)
        .map((parameter) => ({
          name: parameter.name,
          location: parameter.location ?? "query",
        })),
      requiredRequestBodyFields: flattenRequiredFields(endpoint.body.requestBody),
    },
    examples: {
      curl: examples.cURL,
      javascriptFetch: examples.JavaScript,
      pythonRequests: examples.Python,
      jsonToolCall: {
        operationId: operationId(endpoint),
        parameters: requiredParameterValues,
        body: endpoint.body.requestBody.length ? requestBodyValues : undefined,
        credential: auth.required ? auth.credentialPlaceholder : undefined,
      },
    },
    readinessIssues: endpointReadinessIssues(endpoint),
  };
}

function projectMetadata(project: OpenApiExportProject) {
  return {
    title: project.project.title,
    slug: project.project.slug,
    description: project.project.description,
    baseUrl: project.project.baseUrl,
    organization: {
      name: project.organization.name,
      slug: project.organization.slug,
    },
    updatedAt: project.project.updatedAt,
  };
}

function publicVersions(versions: PublicDocumentationVersion[] = []) {
  return versions
    .filter((version) => version.status === "published")
    .sort((left, right) =>
      left.isDefault === right.isDefault
        ? right.updatedAt - left.updatedAt
        : left.isDefault
          ? -1
          : 1,
    );
}

function selectedVersion(
  versions: PublicDocumentationVersion[],
  versionSlug?: string,
) {
  return versionSlug
    ? versions.find((version) => version.slug === versionSlug) ?? null
    : versions.find((version) => version.isDefault) ?? versions[0] ?? null;
}

function versionMetadata(version: PublicDocumentationVersion) {
  return {
    name: version.name,
    slug: version.slug,
    status: version.status,
    isDefault: version.isDefault,
    isBeta: Boolean(version.isBeta),
    isDeprecated: Boolean(version.isDeprecated),
    updatedAt: version.updatedAt,
  };
}

function collectAuthRequirements(endpoints: ExportEndpoint[]) {
  const auth = new Map<string, ReturnType<typeof authMetadata>>();
  for (const endpoint of endpoints) {
    const metadata = authMetadata(endpoint.body.authHeader);
    auth.set(`${metadata.type}:${metadata.header ?? ""}`, metadata);
  }
  return [...auth.values()];
}

function documentedEndpoints(sections: OpenApiExportSection[]) {
  return sections
    .flatMap((section) => section.endpoints)
    .filter((endpoint) => endpoint.endpointType === "endpoint");
}

function authMetadata(auth: ExportEndpoint["body"]["authHeader"]) {
  const header =
    auth.type === "none"
      ? undefined
      : auth.key || (auth.type === "apiKey" ? "X-API-Key" : "Authorization");
  return {
    type: auth.type,
    required: auth.type !== "none",
    header,
    credentialPlaceholder:
      auth.type === "bearer"
        ? "YOUR_TOKEN"
        : auth.type === "basic"
          ? "YOUR_CREDENTIALS"
          : auth.type === "apiKey"
            ? "YOUR_API_KEY"
            : undefined,
  };
}

function parameterMetadata(parameter: ExportField) {
  return {
    name: parameter.name,
    location: parameter.location ?? "query",
    required:
      parameter.location === "path" ? true : Boolean(parameter.required),
    dataType: parameter.dataType,
    description: parameter.description,
  };
}

function fieldMetadata(field: ExportField): Record<string, unknown> {
  return {
    name: field.name,
    dataType: field.dataType,
    required: field.required,
    description: field.description,
    fields: field.fields?.map(fieldMetadata),
  };
}

function sampleObjectFromFields(fields: ExportField[]) {
  return Object.fromEntries(
    fields.map((field) => [field.name, placeholderForField(field)]),
  );
}

function placeholderForField(field: Pick<ExportField, "name" | "dataType"> & {
  fields?: ExportField[];
}): unknown {
  const normalized = field.dataType.trim().toLowerCase();
  if (field.fields?.length) return sampleObjectFromFields(field.fields);
  if (normalized.includes("array")) {
    const scalarType = normalized.replace(/array|[\[\]<>]/g, "") || "string";
    return [placeholderForField({ ...field, dataType: scalarType })];
  }
  if (normalized.includes("bool")) return true;
  if (normalized.includes("int")) return 123;
  if (normalized.includes("number") || normalized.includes("float")) return 12.34;
  if (normalized.includes("uuid")) return "00000000-0000-4000-8000-000000000000";
  if (normalized.includes("date-time") || normalized.includes("datetime")) {
    return "2026-01-01T00:00:00Z";
  }
  if (normalized.includes("date")) return "2026-01-01";
  if (normalized.includes("object")) return {};
  return `YOUR_${field.name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}`;
}

function flattenRequiredFields(fields: ExportField[], prefix = ""): string[] {
  return fields.flatMap((field) => {
    const name = prefix ? `${prefix}.${field.name}` : field.name;
    return [
      ...(field.required ? [name] : []),
      ...flattenRequiredFields(field.fields ?? [], name),
    ];
  });
}

function documentationEntries(data: DocumentationExportData, urls: AgentExportUrls) {
  return [
    ...data.guides.flatMap((section) =>
      section.pages.map((page) => ({
        title: page.title,
        section: section.title,
        type: "guide" as const,
        slug: page.slug,
        description: page.description,
        method: undefined,
        path: undefined,
        url: fillSlug(urls.pageUrlTemplates.guide, page.slug),
        markdownUrl: fillSlug(urls.markdownUrlTemplates.guide, page.slug),
        searchableText: [
          section.title,
          page.title,
          page.description,
          contentToMarkdown(page.markdown, page.content),
        ].join(" "),
      })),
    ),
    ...data.sections.flatMap((section) =>
      section.endpoints.map((endpoint) => ({
        title: endpoint.title,
        section: section.title,
        type: "reference" as const,
        slug: endpoint.slug,
        description: endpoint.body.description,
        method:
          endpoint.endpointType === "endpoint"
            ? endpoint.body.method
            : undefined,
        path:
          endpoint.endpointType === "endpoint" ? endpoint.body.path : undefined,
        url: fillSlug(urls.pageUrlTemplates.reference, endpoint.slug),
        markdownUrl: fillSlug(
          urls.markdownUrlTemplates.reference,
          endpoint.slug,
        ),
        searchableText: [
          section.title,
          endpoint.title,
          endpoint.body.method,
          endpoint.body.path,
          endpoint.body.description,
          contentToMarkdown(endpoint.markdown, endpoint.content),
          endpoint.body.parameters.map((field) => field.name).join(" "),
          endpoint.body.requestBody.map((field) => field.name).join(" "),
        ].join(" "),
      })),
    ),
  ];
}

function scoreText(query: string, searchableText: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;
  const haystack = searchableText.toLowerCase();
  const terms = normalizedQuery
    .split(/[^a-z0-9{}_/.-]+/)
    .filter((term) => term.length > 2);
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    haystack.includes(normalizedQuery) ? 10 : 0,
  );
}

function agentReadiness(data: DocumentationExportData) {
  const issues = data.sections.flatMap((section) =>
    section.endpoints
      .filter((endpoint) => endpoint.endpointType === "endpoint")
      .flatMap((endpoint) =>
        endpointReadinessIssues(endpoint).map((message) => ({
          operationId: operationId(endpoint),
          endpointSlug: endpoint.slug,
          section: section.title,
          message,
        })),
      ),
  );

  return {
    score: Math.max(0, 100 - issues.length * 5),
    issueCount: issues.length,
    issues,
  };
}

function endpointReadinessIssues(endpoint: ExportEndpoint) {
  const issues: string[] = [];
  if (!endpoint.body.description.trim()) {
    issues.push("Missing endpoint description.");
  }
  if (!endpoint.body.sampleResponses.length) {
    issues.push("Missing response examples.");
  }

  const pathParameters = new Set(
    [...endpoint.body.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  );
  for (const parameterName of pathParameters) {
    const documented = endpoint.body.parameters.some(
      (parameter) =>
        parameter.name === parameterName && parameter.location === "path",
    );
    if (!documented) {
      issues.push(`Path parameter "${parameterName}" is not documented.`);
    }
  }

  for (const field of [
    ...endpoint.body.parameters,
    ...flattenFields(endpoint.body.requestBody),
  ]) {
    if (!field.description.trim()) {
      issues.push(`Field "${field.name}" is missing a description.`);
    }
    if (!field.dataType.trim()) {
      issues.push(`Field "${field.name}" is missing a data type.`);
    }
  }

  if (
    endpoint.body.authHeader.type !== "none" &&
    !endpoint.body.authHeader.key.trim()
  ) {
    issues.push("Authenticated endpoint is missing an auth header name.");
  }

  return issues;
}

function flattenFields(fields: ExportField[], prefix = ""): ExportField[] {
  return fields.flatMap((field) => {
    const name = prefix ? `${prefix}.${field.name}` : field.name;
    return [
      { ...field, name },
      ...flattenFields(field.fields ?? [], name),
    ];
  });
}

function latestUpdatedAt(data: DocumentationExportData) {
  return Math.max(
    data.project.project.updatedAt,
    ...data.sections.flatMap((section) =>
      section.endpoints.map((endpoint) => endpoint.updatedAt ?? 0),
    ),
    ...data.guides.flatMap((section) =>
      section.pages.map((page) => page.updatedAt ?? 0),
    ),
    ...(data.versions ?? []).map((version) => version.updatedAt),
    0,
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function url(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}${path}`;
}

function fillSlug(template: string, slug: string) {
  return template.replaceAll("{slug}", encodeURIComponent(slug));
}
