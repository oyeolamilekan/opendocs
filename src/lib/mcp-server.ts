import {
  generateAgentManifest,
  generateToolCatalog,
  getPublicDocumentationPage,
  getPublicEndpointSchema,
  getPublicNavigationTree,
  searchPublicDocumentation,
  type AgentExportUrls,
  type DocumentationExportData,
} from "./agent-export";
import { formatLlmsTxt } from "./llms-text";
import {
  MCP_PROTOCOL_VERSION,
  MCP_RESOURCE_URI_TEMPLATE,
  MCP_TOOLS,
  MCP_TRANSPORT,
} from "./mcp-shared";
import { generateOpenApiDocument } from "./openapi-export";

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type McpResourceDescriptor =
  | { kind: "manifest" | "tools" | "openapi" | "llms.txt" | "navigation" }
  | { kind: "guides" | "reference"; slug: string };

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export type McpServerContext = {
  data: DocumentationExportData;
  urls: AgentExportUrls;
  versionSlug?: string;
};

const MAX_MCP_BODY_BYTES = 256 * 1024;
const MAX_QUERY_LENGTH = 300;
const MAX_SLUG_LENGTH = 160;
const MAX_URI_LENGTH = 800;
const MAX_SEARCH_RESULTS = 10;

const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_INTERNAL_ERROR = -32603;

class McpJsonRpcError extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "McpJsonRpcError";
    this.code = code;
    this.data = data;
  }
}

/**
 * Handles one MCP Streamable HTTP JSON-RPC request.
 *
 * @param options - Handler options.
 * @param options.request - Incoming HTTP request.
 * @param options.loadContext - Lazy public documentation context loader.
 * @returns HTTP response for the MCP request.
 */
export const handleMcpHttpRequest = async ({
  request,
  loadContext,
}: {
  request: Request;
  loadContext: () => Promise<McpServerContext>;
}) => {
  if (!hasTrustedOrigin(request)) {
    return mcpHttpResponse(
      jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Untrusted origin"),
      403,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_BODY_BYTES) {
    return mcpHttpResponse(
      jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Request body is too large"),
      413,
    );
  }

  let body = "";
  try {
    body = await request.text();
  } catch {
    return mcpHttpResponse(
      jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Unable to read body"),
      400,
    );
  }

  if (body.length > MAX_MCP_BODY_BYTES) {
    return mcpHttpResponse(
      jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Request body is too large"),
      413,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return mcpHttpResponse(
      jsonRpcError(null, JSON_RPC_PARSE_ERROR, "Parse error"),
      400,
    );
  }

  let contextPromise: Promise<McpServerContext> | null = null;
  const getContext = () => {
    contextPromise ??= loadContext();
    return contextPromise;
  };

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return mcpHttpResponse(
        jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Invalid request"),
        400,
      );
    }

    const responses = await Promise.all(
      payload.map((message) => handleJsonRpcMessage(message, getContext)),
    );
    const responsePayload = responses.filter(
      (response): response is Exclude<typeof response, undefined> =>
        response !== undefined,
    );

    if (!responsePayload.length) return new Response(null, { status: 204 });
    return mcpHttpResponse(responsePayload);
  }

  const response = await handleJsonRpcMessage(payload, getContext);
  if (!response) return new Response(null, { status: 204 });
  return mcpHttpResponse(response);
};

/**
 * Builds the .well-known MCP discovery document for a project.
 *
 * @param context - Public MCP server context.
 * @returns JSON discovery payload.
 */
export const generateMcpDiscovery = (context: McpServerContext) => {
  const project = context.data.project.project;
  const version = currentVersion(context);

  return {
    schemaVersion: "1.0",
    name: "openapidoc MCP Discovery",
    project: {
      title: project.title,
      slug: project.slug,
      description: project.description,
      organization: context.data.project.organization,
    },
    version,
    mcp: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      transport: MCP_TRANSPORT,
      serverUrl: mcpServerUrl(context.urls),
      discoveryUrl: mcpDiscoveryUrl(context.urls),
      auth: {
        required: false,
        type: "none",
      },
      capabilities: {
        tools: MCP_TOOLS.map(({ name, title, description }) => ({
          name,
          title,
          description,
        })),
        resources: {
          uriScheme: "openapidoc://",
          uriTemplate: MCP_RESOURCE_URI_TEMPLATE,
          list: true,
          read: true,
        },
      },
    },
    exports: {
      agentManifestUrl: context.urls.agentManifestUrl ?? null,
      toolCatalogUrl: context.urls.toolCatalogUrl ?? null,
      openapiUrl: context.urls.openapiUrl ?? null,
      llmsTxtUrl: context.urls.llmsTxtUrl ?? null,
    },
    security: {
      readOnly: true,
      exposesStoredCredentials: false,
      executesDocumentedEndpoints: false,
      notes:
        "This MCP server exposes only published documentation for public projects.",
    },
  };
};

const handleJsonRpcMessage = async (
  value: unknown,
  getContext: () => Promise<McpServerContext>,
) => {
  const parsed = parseJsonRpcRequest(value);
  if ("error" in parsed) return parsed.error;

  if (parsed.notification) {
    await dispatchMcpMethod(parsed.request, getContext);
    return undefined;
  }

  try {
    const result = await dispatchMcpMethod(parsed.request, getContext);
    return {
      jsonrpc: "2.0" as const,
      id: parsed.request.id ?? null,
      result: result ?? null,
    };
  } catch (error) {
    if (error instanceof McpJsonRpcError) {
      return jsonRpcError(
        parsed.request.id ?? null,
        error.code,
        error.message,
        error.data,
      );
    }

    return jsonRpcError(
      parsed.request.id ?? null,
      JSON_RPC_INTERNAL_ERROR,
      "Internal error",
    );
  }
};

const dispatchMcpMethod = async (
  request: JsonRpcRequest,
  getContext: () => Promise<McpServerContext>,
) => {
  if (request.method === "notifications/initialized") return null;
  if (request.method === "ping") return {};

  const context = await getContext();

  if (request.method === "initialize") {
    return initializeResult(context);
  }
  if (request.method === "tools/list") {
    return { tools: MCP_TOOLS };
  }
  if (request.method === "tools/call") {
    return callMcpTool(context, request.params);
  }
  if (request.method === "resources/list") {
    return { resources: listMcpResources(context) };
  }
  if (request.method === "resources/read") {
    return readMcpResource(context, request.params);
  }

  throw new McpJsonRpcError(
    JSON_RPC_METHOD_NOT_FOUND,
    `Method not found: ${request.method}`,
  );
};

const initializeResult = (context: McpServerContext) => {
  const project = context.data.project.project;

  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
        listChanged: false,
      },
    },
    serverInfo: {
      name: "openapidoc",
      title: `${project.title} MCP Server`,
      version: "1.0.0",
    },
    instructions:
      "Read-only MCP access to this project's published guides, API reference, OpenAPI schema, and navigation. This server never executes documented endpoints.",
  };
};

const callMcpTool = (context: McpServerContext, params: unknown) => {
  const call = requireRecord(params, "tools/call params must be an object");
  const name = requireString(call.name, "Tool name is required", 80);
  const args = optionalRecord(call.arguments, "Tool arguments must be an object");

  if (name === "search_docs") {
    const query = requireString(args.query, "query is required", MAX_QUERY_LENGTH);
    const limit = boundedInteger(args.limit, 10, 1, MAX_SEARCH_RESULTS);
    return toolResult({
      project: context.data.project.project,
      version: currentVersion(context),
      results: searchPublicDocumentation({
        data: context.data,
        urls: context.urls,
        query,
        limit,
      }),
    });
  }

  if (name === "get_doc_page") {
    const type = requireString(args.type, "type is required", 20);
    if (type !== "guide" && type !== "reference") {
      throw new McpJsonRpcError(
        JSON_RPC_INVALID_PARAMS,
        "type must be guide or reference",
      );
    }
    const slug = requireString(args.slug, "slug is required", MAX_SLUG_LENGTH);
    const page = getPublicDocumentationPage({
      data: context.data,
      urls: context.urls,
      type,
      slug,
    });
    if (!page) {
      throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Page not found");
    }
    return toolResult(page);
  }

  if (name === "get_endpoint_schema") {
    const slug = optionalString(args.slug, MAX_SLUG_LENGTH);
    const operationId = optionalString(args.operationId, MAX_SLUG_LENGTH);
    if (!slug && !operationId) {
      throw new McpJsonRpcError(
        JSON_RPC_INVALID_PARAMS,
        "slug or operationId is required",
      );
    }
    const endpoint = getPublicEndpointSchema({
      data: context.data,
      urls: context.urls,
      slug,
      id: operationId,
    });
    if (!endpoint) {
      throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Endpoint not found");
    }
    return toolResult(endpoint);
  }

  if (name === "get_navigation") {
    return toolResult(
      getPublicNavigationTree({
        data: context.data,
        urls: context.urls,
        versionSlug: context.versionSlug,
      }),
    );
  }

  throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, `Unknown tool: ${name}`);
};

const listMcpResources = (context: McpServerContext) => {
  const baseUri = mcpResourceBaseUri(context);
  const resources = [
    {
      uri: `${baseUri}/manifest`,
      name: "project_manifest",
      title: "Project agent manifest",
      description: "Agent-facing project discovery manifest.",
      mimeType: "application/json",
    },
    {
      uri: `${baseUri}/tools`,
      name: "tool_catalog",
      title: "API operation catalog",
      description: "Structured API reference operation metadata.",
      mimeType: "application/json",
    },
    {
      uri: `${baseUri}/openapi`,
      name: "openapi",
      title: "OpenAPI document",
      description: "Generated OpenAPI 3.1 document.",
      mimeType: "application/json",
    },
    {
      uri: `${baseUri}/llms.txt`,
      name: "llms_txt",
      title: "llms.txt",
      description: "LLM-oriented documentation index.",
      mimeType: "text/plain",
    },
    {
      uri: `${baseUri}/navigation`,
      name: "navigation",
      title: "Navigation tree",
      description: "Published guide, reference, and version navigation.",
      mimeType: "application/json",
    },
  ];

  for (const section of context.data.guides) {
    for (const page of section.pages) {
      resources.push({
        uri: `${baseUri}/guides/${encodeURIComponent(page.slug)}`,
        name: `guide:${page.slug}`,
        title: page.title,
        description: page.description || `Guide in ${section.title}.`,
        mimeType: "text/markdown",
      });
    }
  }

  for (const section of context.data.sections) {
    for (const endpoint of section.endpoints) {
      resources.push({
        uri: `${baseUri}/reference/${encodeURIComponent(endpoint.slug)}`,
        name: `reference:${endpoint.slug}`,
        title: endpoint.title,
        description: endpoint.body.description || `Reference in ${section.title}.`,
        mimeType: "text/markdown",
      });
    }
  }

  return resources;
};

const readMcpResource = (context: McpServerContext, params: unknown) => {
  const input = requireRecord(params, "resources/read params must be an object");
  const uri = requireString(input.uri, "uri is required", MAX_URI_LENGTH);
  const resource = parseMcpResourceUri(context, uri);

  if (resource.kind === "manifest") {
    return resourceContents(
      uri,
      "application/json",
      generateAgentManifest({
        data: context.data,
        urls: context.urls,
        versionSlug: context.versionSlug,
      }),
    );
  }

  if (resource.kind === "tools") {
    return resourceContents(
      uri,
      "application/json",
      generateToolCatalog({
        data: context.data,
        urls: context.urls,
        versionSlug: context.versionSlug,
      }),
    );
  }

  if (resource.kind === "openapi") {
    return resourceContents(
      uri,
      "application/json",
      generateOpenApiDocument({
        project: context.data.project,
        sections: context.data.sections,
      }),
    );
  }

  if (resource.kind === "llms.txt") {
    return resourceContents(
      uri,
      "text/plain",
      formatLlmsTxt({
        project: context.data.project,
        guides: context.data.guides,
        sections: context.data.sections,
        publicBaseUrl: context.urls.publicBaseUrl,
      }),
    );
  }

  if (resource.kind === "navigation") {
    return resourceContents(
      uri,
      "application/json",
      getPublicNavigationTree({
        data: context.data,
        urls: context.urls,
        versionSlug: context.versionSlug,
      }),
    );
  }

  if (resource.kind === "guides" || resource.kind === "reference") {
    const page = getPublicDocumentationPage({
      data: context.data,
      urls: context.urls,
      type: resource.kind === "guides" ? "guide" : "reference",
      slug: resource.slug,
    });
    if (!page) {
      throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Resource not found");
    }
    return resourceContents(uri, "text/markdown", page.markdown);
  }

  throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Resource not found");
};

const parseMcpResourceUri = (
  context: McpServerContext,
  uri: string,
): McpResourceDescriptor => {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Invalid resource URI");
  }

  if (url.protocol !== "openapidoc:" || url.hostname !== "docs") {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Unsupported resource URI");
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        throw new McpJsonRpcError(
          JSON_RPC_INVALID_PARAMS,
          "Invalid resource URI encoding",
        );
      }
    });

  const [projectSlug, versionSlug, kind, slug] = segments;
  if (!projectSlug || !versionSlug || !kind) {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Invalid resource URI");
  }
  if (projectSlug !== context.data.project.project.slug) {
    throw new McpJsonRpcError(
      JSON_RPC_INVALID_PARAMS,
      "Resource belongs to another project",
    );
  }
  if (versionSlug !== currentVersionSlug(context)) {
    throw new McpJsonRpcError(
      JSON_RPC_INVALID_PARAMS,
      "Resource belongs to another version",
    );
  }
  if ((kind === "guides" || kind === "reference") && slug) {
    return { kind, slug };
  }
  if (
    kind === "manifest" ||
    kind === "tools" ||
    kind === "openapi" ||
    kind === "llms.txt" ||
    kind === "navigation"
  ) {
    return { kind };
  }

  throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Invalid resource URI");
};

const resourceContents = (
  uri: string,
  mimeType: string,
  value: string | unknown,
) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
};

const toolResult = (value: unknown) => {
  const text = JSON.stringify(value, null, 2);
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent: value,
  };
};

const parseJsonRpcRequest = (
  value: unknown,
):
  | { request: JsonRpcRequest; notification: boolean }
  | { error: JsonRpcFailure } => {
  if (!isRecord(value)) {
    return {
      error: jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Invalid request"),
    };
  }

  const id = jsonRpcIdFromValue(value.id);
  if (hasOwn(value, "id") && id === undefined) {
    return {
      error: jsonRpcError(null, JSON_RPC_INVALID_REQUEST, "Invalid request id"),
    };
  }

  if (value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return {
      error: jsonRpcError(id ?? null, JSON_RPC_INVALID_REQUEST, "Invalid request"),
    };
  }

  return {
    request: {
      jsonrpc: "2.0",
      id,
      method: value.method,
      params: value.params,
    },
    notification: !hasOwn(value, "id"),
  };
};

const jsonRpcIdFromValue = (value: unknown): JsonRpcId | undefined => {
  if (value === null || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
};

const jsonRpcError = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure => {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
};

const mcpHttpResponse = (value: unknown, status = 200) => {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    },
  });
};

const hasTrustedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
};

const requireRecord = (value: unknown, message: string) => {
  if (!isRecord(value)) {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, message);
  }
  return value;
};

const optionalRecord = (value: unknown, message: string) => {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, message);
  }
  return value;
};

const requireString = (value: unknown, message: string, maxLength: number) => {
  const parsed = optionalString(value, maxLength);
  if (!parsed) throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, message);
  return parsed;
};

const optionalString = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Expected string value");
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Value is too long");
  }
  return trimmed;
};

const boundedInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new McpJsonRpcError(JSON_RPC_INVALID_PARAMS, "Expected integer value");
  }
  return Math.min(Math.max(value, min), max);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const hasOwn = (value: Record<string, unknown>, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

const currentVersion = (context: McpServerContext) => {
  const versions = publishedVersions(context.data);
  const match = context.versionSlug
    ? versions.find((version) => version.slug === context.versionSlug)
    : undefined;
  return (
    match ??
    versions.find((version) => version.isDefault) ??
    versions[0] ??
    null
  );
};

const currentVersionSlug = (context: McpServerContext) => {
  return currentVersion(context)?.slug ?? "default";
};

const publishedVersions = (data: DocumentationExportData) => {
  return (data.versions ?? [])
    .filter((version) => version.status === "published")
    .sort((left, right) =>
      left.isDefault === right.isDefault
        ? right.updatedAt - left.updatedAt
        : left.isDefault
          ? -1
          : 1,
    );
};

const mcpResourceBaseUri = (context: McpServerContext) => {
  return `openapidoc://docs/${encodeURIComponent(
    context.data.project.project.slug,
  )}/${encodeURIComponent(currentVersionSlug(context))}`;
};

const mcpServerUrl = (urls: AgentExportUrls) => {
  return urls.mcpUrl ?? `${urls.publicBaseUrl.replace(/\/$/, "")}/mcp`;
};

const mcpDiscoveryUrl = (urls: AgentExportUrls) => {
  return (
    urls.mcpWellKnownUrl ??
    `${urls.publicBaseUrl.replace(/\/$/, "")}/.well-known/mcp.json`
  );
};
