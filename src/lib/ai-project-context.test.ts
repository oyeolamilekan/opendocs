import { describe, expect, it } from "vitest";
import {
  buildAiSystemPrompt,
  buildProjectAiContext,
  type AiProjectContextData,
} from "./ai-project-context";

const data: AiProjectContextData = {
  project: {
    title: "Payments API",
    slug: "payments-api",
    baseUrl: "https://api.example.com",
    description: "Payment operations.",
    visibility: "private",
  },
  guideSections: [
    {
      title: "Guides",
      slug: "guides",
      pages: [
        {
          title: "Authentication",
          slug: "authentication",
          description: "How auth works.",
          markdown: "Use a bearer token.",
        },
      ],
    },
  ],
  apiSections: [
    {
      title: "Transactions",
      slug: "transactions",
      endpoints: [
        {
          title: "Create transaction",
          slug: "create-transaction",
          endpointType: "endpoint",
          body: {
            method: "POST",
            path: "/transactions",
            description: "Creates a transaction.",
            parameters: [],
            requestBody: [
              {
                name: "amount",
                dataType: "number",
                required: true,
                description: "Amount in cents.",
              },
            ],
            authHeader: {
              type: "bearer",
              key: "Authorization",
              value: "secret-token",
            },
            sampleResponses: [
              {
                statusCode: 201,
                description: "Created.",
                body: '{"id":"txn_123"}',
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("AI project context", () => {
  it("builds bounded docs context with endpoint metadata and docs page links", () => {
    const context = buildProjectAiContext({
      data,
      latestUserMessage: "How do I create a transaction?",
      publicDocsBasePath: "https://payments-api.example.com",
    });

    expect(context).toContain("# Payments API");
    expect(context).toContain("POST /transactions");
    expect(context).toContain("amount: number required");
    expect(context).toContain(
      "Docs page: https://payments-api.example.com/reference/create-transaction",
    );
    expect(context).not.toContain(".md");
  });

  it("does not include stored auth secret values", () => {
    const context = buildProjectAiContext({
      data,
      latestUserMessage: "auth token",
      publicDocsBasePath: "https://payments-api.example.com",
    });

    expect(context).toContain("value intentionally omitted");
    expect(context).not.toContain("secret-token");
  });

  it("wraps context in a restrictive system prompt", () => {
    const prompt = buildAiSystemPrompt({ context: "Project context" });

    expect(prompt).toContain("using only the project documentation context");
    expect(prompt).toContain("not .md export routes");
    expect(prompt).toContain("Project context");
  });
});
