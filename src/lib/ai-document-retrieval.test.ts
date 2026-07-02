import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  buildRetrievalSystemPrompt,
  buildFinalAnswerPrompt,
  getCurrentDocumentationPage,
  getDocumentationPage,
  getDocumentationSources,
  searchDocumentation,
  sanitizeAiResponseText,
} from "./ai-document-retrieval";
import type { AiProjectContextData } from "./ai-project-context";

const data: AiProjectContextData = {
  project: {
    title: "Payments API",
    slug: "payments",
    baseUrl: "https://api.example.com",
    description: "Payment operations.",
    visibility: "public",
  },
  guideSections: [
    {
      title: "Getting started",
      slug: "getting-started",
      pages: [
        {
          title: "Authentication",
          slug: "authentication",
          description: "Configure bearer authentication.",
          markdown: "Send the token using the Authorization header.",
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
          markdown: "Creates a new payment transaction.",
          body: {
            method: "POST",
            path: "/transactions",
            description: "Create a transaction.",
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
            sampleResponses: [],
          },
        },
      ],
    },
  ],
};

const baseUrl = "https://payments.example.com";

describe("AI documentation retrieval", () => {
  it("searches a compact index and returns full canonical URLs", () => {
    expect(
      searchDocumentation({
        data,
        query: "create transaction amount",
        publicDocsBasePath: baseUrl,
      })[0],
    ).toMatchObject({
      title: "Create transaction",
      type: "reference",
      url: `${baseUrl}/reference/create-transaction`,
    });
  });

  it("loads one bounded page without exposing authentication secrets", () => {
    const page = getDocumentationPage({
      data,
      type: "reference",
      slug: "create-transaction",
      publicDocsBasePath: baseUrl,
    });

    expect(page).toMatchObject({
      source: {
        url: `${baseUrl}/reference/create-transaction`,
      },
      method: "POST",
      path: "/transactions",
      authentication: {
        value: "intentionally omitted",
      },
    });
    expect(JSON.stringify(page)).not.toContain("secret-token");
  });

  it("resolves the current documentation route", () => {
    expect(
      getCurrentDocumentationPage({
        data,
        currentPagePath: "/docs/authentication",
        publicDocsBasePath: baseUrl,
      }),
    ).toMatchObject({
      source: {
        url: `${baseUrl}/docs/authentication`,
      },
    });
  });

  it("extracts and deduplicates sources from tool result parts", () => {
    const message = {
      parts: [
        {
          type: "tool-getDocumentationPage",
          state: "output-available",
          output: {
            source: {
              title: "Create transaction",
              type: "reference",
              url: `${baseUrl}/reference/create-transaction`,
            },
          },
        },
      ],
    } as unknown as UIMessage;

    expect(getDocumentationSources(message)).toEqual([
      {
        title: "Create transaction",
        type: "reference",
        url: `${baseUrl}/reference/create-transaction`,
      },
    ]);
  });

  it("requires tool grounding and complete source URLs", () => {
    const prompt = buildRetrievalSystemPrompt({ project: data.project });
    expect(prompt).toContain("documentation returned by the provided tools");
    expect(prompt).toContain("complete absolute URL");
    expect(prompt).toContain("Cite documentation inline");
  });

  it("forces the final step to produce prose without tool syntax", () => {
    const prompt = buildFinalAnswerPrompt("Base prompt");
    expect(prompt).toContain("Write the complete user-facing answer now");
    expect(prompt).toContain("Do not emit tool calls");
  });

  it("removes leaked provider tool markup from rendered text", () => {
    expect(
      sanitizeAiResponseText(`Use the initiate endpoint.
< | | DSML | | tool_calls>
< | | DSML | | invoke name="getDocumentationPage">
Then verify the transaction.`),
    ).toBe("Use the initiate endpoint.\nThen verify the transaction.");
  });
});
