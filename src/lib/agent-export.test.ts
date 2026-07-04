import { describe, expect, it } from "vitest";
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
import type { ExportEndpoint } from "./markdown-export";

const endpoint: ExportEndpoint = {
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
      {
        name: "include",
        location: "query",
        required: false,
        dataType: "string",
        description: "Extra fields.",
      },
    ],
    requestBody: [
      {
        name: "profile",
        required: true,
        dataType: "object",
        description: "User profile.",
        fields: [
          {
            name: "name",
            required: true,
            dataType: "string",
            description: "Display name.",
          },
        ],
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
};

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
    {
      name: "v2.0",
      slug: "v2.0",
      status: "published",
      isDefault: false,
      isBeta: true,
      isDeprecated: false,
      updatedAt: 11,
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
      endpoints: [endpoint],
    },
  ],
};

const urls: AgentExportUrls = {
  publicBaseUrl: "https://acme-docs.example.com",
  apiBaseUrl: "https://acme-docs.example.com",
  agentManifestUrl: "https://acme-docs.example.com/agent.json",
  toolCatalogUrl: "https://acme-docs.example.com/tools.json",
  openapiUrl: "https://acme-docs.example.com/openapi.json",
  llmsTxtUrl: "https://acme-docs.example.com/llms.txt",
  pageUrlTemplates: {
    guide: "https://acme-docs.example.com/docs/{slug}",
    reference: "https://acme-docs.example.com/reference/{slug}",
  },
  markdownUrlTemplates: {
    guide: "https://acme-docs.example.com/guides/{slug}.md",
    reference: "https://acme-docs.example.com/reference/{slug}.md",
  },
  retrievalApi: {
    search: "https://acme-docs.example.com/api/public/docs/search?q={query}",
    page: "https://acme-docs.example.com/api/public/docs/page?type={guide|reference}&slug={slug}",
    endpoint:
      "https://acme-docs.example.com/api/public/docs/endpoint?slug={slug}",
    navigation: "https://acme-docs.example.com/api/public/docs/navigation",
  },
};

describe("agent export formatters", () => {
  it("generates an agent manifest with discovery links and safe execution metadata", () => {
    const manifest = generateAgentManifest({ data, urls, versionSlug: "v2.0" });

    expect(manifest.project).toMatchObject({
      title: "Acme Docs",
      slug: "acme-docs",
      baseUrl: "https://api.example.com",
    });
    expect(manifest.version).toMatchObject({
      slug: "v2.0",
      isBeta: true,
    });
    expect(manifest.documentation).toMatchObject({
      agentManifestUrl: "https://acme-docs.example.com/agent.json",
      toolCatalogUrl: "https://acme-docs.example.com/tools.json",
      openapiUrl: "https://acme-docs.example.com/openapi.json",
      llmsTxtUrl: "https://acme-docs.example.com/llms.txt",
    });
    expect(manifest.capabilities.executeEndpoint).toMatchObject({
      available: false,
      requiresExplicitProjectOptIn: true,
    });
    expect(JSON.stringify(manifest)).not.toContain("sk-stored-secret");
  });

  it("generates a tool catalog with stable operation data and request recipes", () => {
    const catalog = generateToolCatalog({ data, urls });
    const operation = catalog.operations[0];

    expect(operation).toMatchObject({
      operationId: "createUser",
      method: "POST",
      path: "/v1/users/{id}",
      docsUrl: "https://acme-docs.example.com/reference/create-user",
      markdownUrl: "https://acme-docs.example.com/reference/create-user.md",
      auth: {
        type: "bearer",
        header: "Authorization",
        credentialPlaceholder: "YOUR_TOKEN",
      },
      validation: {
        requiredParameters: [{ name: "id", location: "path" }],
        requiredRequestBodyFields: ["profile", "profile.name"],
      },
    });
    expect(operation.requestBody?.schema).toMatchObject({
      type: "object",
      required: ["profile"],
      properties: {
        profile: {
          type: "object",
          required: ["name"],
        },
      },
    });
    expect(operation.examples.curl).toContain("curl --request POST");
    expect(operation.examples.javascriptFetch).toContain("fetch(");
    expect(operation.examples.pythonRequests).toContain("requests.post");
    expect(operation.examples.jsonToolCall).toMatchObject({
      operationId: "createUser",
      parameters: { id: "YOUR_ID" },
      credential: "YOUR_TOKEN",
    });
    expect(JSON.stringify(catalog)).not.toContain("sk-stored-secret");
  });

  it("supports public retrieval search, page fetch, endpoint fetch, and navigation", () => {
    const results = searchPublicDocumentation({
      data,
      urls,
      query: "create user",
    });
    const page = getPublicDocumentationPage({
      data,
      urls,
      type: "reference",
      slug: "create-user",
    });
    const schema = getPublicEndpointSchema({
      data,
      urls,
      id: "createUser",
    });
    const navigation = getPublicNavigationTree({ data, urls });

    expect(results[0]).toMatchObject({
      type: "reference",
      slug: "create-user",
      method: "POST",
      path: "/v1/users/{id}",
    });
    expect(page).toMatchObject({
      title: "Create user",
      markdownUrl: "https://acme-docs.example.com/reference/create-user.md",
    });
    expect(page?.markdown).toContain("Authorization: Bearer YOUR_TOKEN");
    expect(schema?.operationId).toBe("createUser");
    expect(navigation.guides[0]?.pages[0]).toMatchObject({
      title: "Intro",
      url: "https://acme-docs.example.com/docs/intro",
    });
  });
});
