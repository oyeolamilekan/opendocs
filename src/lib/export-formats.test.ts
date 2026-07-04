import { describe, expect, it } from "vitest";
import { formatLlmsTxt } from "./llms-text";
import {
  contentToMarkdown,
  formatEndpointMarkdown,
  formatGuideMarkdown,
  type ExportEndpoint,
} from "./markdown-export";
import { generateOpenApiDocument } from "./openapi-export";

const endpoint: ExportEndpoint = {
  title: "Create user",
  slug: "create-user",
  endpointType: "endpoint",
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

const project = {
  organization: {
    name: "Acme",
    slug: "acme",
  },
  project: {
    title: "Acme Docs",
    slug: "acme-docs",
    baseUrl: "https://api.example.com",
    description: "API docs for Acme.",
    updatedAt: 1,
  },
};

describe("documentation export formatters", () => {
  it("formats an endpoint as readable Markdown", () => {
    const markdown = formatEndpointMarkdown({
      endpoint,
      baseUrl: "https://api.example.com",
    });

    expect(markdown).toContain("# Create user");
    expect(markdown).toContain("POST /v1/users/{id}");
    expect(markdown).toContain("## Authentication");
    expect(markdown).toContain("Authorization: Bearer YOUR_TOKEN");
    expect(markdown).toContain(
      "| profile.name | string | Yes | Display name. |",
    );
    expect(markdown).toContain("```bash\ncurl --request POST");
  });

  it("formats guide Markdown from stored markdown or Tiptap JSON", () => {
    expect(
      formatGuideMarkdown({
        guide: {
          title: "Intro",
          slug: "intro",
          description: "Start here.",
          markdown: "## Welcome\n\nHello",
        },
      }),
    ).toContain("## Welcome");

    expect(
      contentToMarkdown(
        "",
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Install" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Use the API." }],
            },
          ],
        }),
      ),
    ).toBe("## Install\n\nUse the API.");
  });

  it("formats llms.txt with markdown export links and OpenAPI link", () => {
    const llms = formatLlmsTxt({
      project,
      publicBaseUrl: "https://acme-docs.docs.example.com",
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
    });

    expect(llms).toContain("# Acme Docs");
    expect(llms).toContain(
      "https://acme-docs.docs.example.com/guides/intro.md",
    );
    expect(llms).toContain(
      "https://acme-docs.docs.example.com/reference/create-user.md",
    );
    expect(llms).toContain("https://acme-docs.docs.example.com/openapi.json");
  });

  it("generates an OpenAPI document from endpoint metadata", () => {
    const openapi = generateOpenApiDocument({
      project,
      sections: [
        {
          title: "Users",
          slug: "users",
          position: 0,
          endpoints: [endpoint],
        },
      ],
    }) as {
      paths: Record<string, Record<string, unknown>>;
      components: {
        securitySchemes: Record<string, unknown>;
      };
    };

    expect(openapi.paths["/v1/users/{id}"].post).toMatchObject({
      summary: "Create user",
      tags: ["Users"],
    });
    expect(openapi.components.securitySchemes.BearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
  });
});
