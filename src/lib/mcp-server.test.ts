import { describe, expect, it } from "vitest";
import type { DocumentationExportData } from "./agent-export";
import { handleMcpHttpRequest, generateMcpDiscovery } from "./mcp-server";
import type { McpServerContext } from "./mcp-server";

const data: DocumentationExportData = {
  project: {
    organization: {
      name: "Acme",
      slug: "acme",
    },
    project: {
      title: "Acme Docs",
      slug: "acme-docs",
      baseUrl: "https://api.example.com",
      description: "API docs for Acme.",
      updatedAt: 10,
    },
  },
  versions: [
    {
      name: "v1.0",
      slug: "v1.0",
      status: "published",
      isDefault: true,
      isBeta: false,
      isDeprecated: false,
      updatedAt: 9,
    },
  ],
  guides: [
    {
      title: "Guides",
      slug: "guides",
      position: 0,
      pages: [
        {
          title: "Intro",
          slug: "intro",
          description: "Start here.",
          markdown: "## Welcome\n\nCreate your first user.",
          updatedAt: 12,
        },
      ],
    },
  ],
  sections: [
    {
      title: "Users",
      slug: "users",
      position: 0,
      endpoints: [
        {
          title: "Create user",
          slug: "create-user",
          endpointType: "endpoint",
          updatedAt: 20,
          body: {
            method: "POST",
            path: "/v1/users/{id}",
            description: "Creates a user.",
            parameters: [
              {
                name: "id",
                location: "path",
                required: true,
                dataType: "string",
                description: "User ID.",
              },
            ],
            requestBody: [
              {
                name: "email",
                required: true,
                dataType: "string",
                description: "User email.",
              },
            ],
            authHeader: {
              type: "bearer",
              key: "Authorization",
              value: "sk-stored-secret",
            },
            sampleResponses: [
              {
                statusCode: 201,
                description: "Created.",
                body: '{ "id": "user_123" }',
              },
            ],
          },
        },
      ],
    },
  ],
};

const context: McpServerContext = {
  data,
  versionSlug: "v1.0",
  urls: {
    publicBaseUrl: "https://acme-docs.example.com/v/v1.0",
    apiBaseUrl: "https://acme-docs.example.com",
    agentManifestUrl: "https://acme-docs.example.com/v/v1.0/agent.json",
    toolCatalogUrl: "https://acme-docs.example.com/v/v1.0/tools.json",
    openapiUrl: "https://acme-docs.example.com/v/v1.0/openapi.json",
    llmsTxtUrl: "https://acme-docs.example.com/v/v1.0/llms.txt",
    mcpUrl: "https://acme-docs.example.com/v/v1.0/mcp",
    mcpWellKnownUrl: "https://acme-docs.example.com/.well-known/mcp.json",
    pageUrlTemplates: {
      guide: "https://acme-docs.example.com/v1.0/docs/{slug}",
      reference: "https://acme-docs.example.com/v1.0/reference/{slug}",
    },
    markdownUrlTemplates: {
      guide: "https://acme-docs.example.com/v/v1.0/guides/{slug}.md",
      reference: "https://acme-docs.example.com/v/v1.0/reference/{slug}.md",
    },
  },
};

describe("mcp server", () => {
  it("initializes with read-only tools and resources", async () => {
    const response = await mcpCall({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
      },
    });
    const payload = (await response.json()) as { result: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false },
      },
    });
    expect(JSON.stringify(payload)).not.toContain("sk-stored-secret");
  });

  it("lists and calls read-only documentation tools", async () => {
    const listResponse = await mcpCall({
      jsonrpc: "2.0",
      id: "list",
      method: "tools/list",
    });
    const listPayload = (await listResponse.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(listPayload.result.tools.map((tool) => tool.name)).toContain(
      "search_docs",
    );

    const callResponse = await mcpCall({
      jsonrpc: "2.0",
      id: "call",
      method: "tools/call",
      params: {
        name: "get_doc_page",
        arguments: {
          type: "reference",
          slug: "create-user",
        },
      },
    });
    const callPayload = (await callResponse.json()) as {
      result: {
        structuredContent: { markdown: string };
      };
    };

    expect(callPayload.result.structuredContent.markdown).toContain(
      "curl --request POST",
    );
    expect(JSON.stringify(callPayload)).not.toContain("sk-stored-secret");
  });

  it("lists and reads MCP resources", async () => {
    const listResponse = await mcpCall({
      jsonrpc: "2.0",
      id: "resources",
      method: "resources/list",
    });
    const listPayload = (await listResponse.json()) as {
      result: { resources: Array<{ uri: string; mimeType: string }> };
    };
    const reference = listPayload.result.resources.find((resource) =>
      resource.uri.endsWith("/reference/create-user"),
    );

    expect(reference).toMatchObject({ mimeType: "text/markdown" });

    const readResponse = await mcpCall({
      jsonrpc: "2.0",
      id: "read",
      method: "resources/read",
      params: {
        uri: reference?.uri,
      },
    });
    const readPayload = (await readResponse.json()) as {
      result: { contents: Array<{ text: string; mimeType: string }> };
    };

    expect(readPayload.result.contents[0]).toMatchObject({
      mimeType: "text/markdown",
    });
    expect(readPayload.result.contents[0]?.text).toContain("Example request");
    expect(JSON.stringify(readPayload)).not.toContain("sk-stored-secret");
  });

  it("supports notifications without a response body", async () => {
    const response = await mcpCall({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("rejects cross-origin browser POSTs", async () => {
    const response = await mcpCall(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "ping",
      },
      "https://evil.example.com",
    );
    const payload = (await response.json()) as {
      error: { code: number; message: string };
    };

    expect(response.status).toBe(403);
    expect(payload.error).toMatchObject({
      code: -32600,
      message: "Untrusted origin",
    });
  });

  it("generates .well-known MCP discovery", () => {
    expect(generateMcpDiscovery(context)).toMatchObject({
      project: {
        title: "Acme Docs",
        slug: "acme-docs",
      },
      mcp: {
        protocolVersion: "2025-06-18",
        serverUrl: "https://acme-docs.example.com/v/v1.0/mcp",
        auth: { required: false, type: "none" },
      },
      security: {
        readOnly: true,
        executesDocumentedEndpoints: false,
      },
    });
  });
});

async function mcpCall(payload: unknown, origin?: string) {
  return handleMcpHttpRequest({
    request: new Request("https://acme-docs.example.com/v/v1.0/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify(payload),
    }),
    loadContext: async () => context,
  });
}
