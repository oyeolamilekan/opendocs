export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_TRANSPORT = "streamable-http";
export const MCP_RESOURCE_URI_TEMPLATE =
  "openapidoc://docs/{projectSlug}/{versionSlug}/{resource}";

export const MCP_TOOLS = [
  {
    name: "search_docs",
    title: "Search documentation",
    description:
      "Search published guide and API reference documentation for this project.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Search query text.",
          minLength: 1,
          maxLength: 300,
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return.",
          minimum: 1,
          maximum: 10,
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_doc_page",
    title: "Get documentation page",
    description:
      "Fetch one published guide or API reference page as agent-readable Markdown.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["guide", "reference"],
          description: "Documentation page type.",
        },
        slug: {
          type: "string",
          description: "Public page slug.",
          minLength: 1,
          maxLength: 160,
        },
      },
      required: ["type", "slug"],
    },
  },
  {
    name: "get_endpoint_schema",
    title: "Get endpoint schema",
    description:
      "Fetch structured request, response, auth, validation, and example metadata for one documented endpoint.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: {
          type: "string",
          description: "Public endpoint slug.",
          minLength: 1,
          maxLength: 160,
        },
        operationId: {
          type: "string",
          description: "Generated operation identifier.",
          minLength: 1,
          maxLength: 160,
        },
      },
      anyOf: [{ required: ["slug"] }, { required: ["operationId"] }],
    },
  },
  {
    name: "get_navigation",
    title: "Get documentation navigation",
    description:
      "Fetch the published guide, reference, and version navigation tree for this project.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
] as const;

export const MCP_TOOL_NAMES = MCP_TOOLS.map((tool) => tool.name);
