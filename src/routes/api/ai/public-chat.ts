import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import {
  buildRetrievalSystemPrompt,
  getCurrentDocumentationPage,
  getDocumentationPage,
  searchDocumentation,
  sanitizeAiResponseText,
} from "../../../lib/ai-document-retrieval";

const MAX_REQUEST_BYTES = 128 * 1024;
const MAX_MESSAGES = 12;

type PublicChatInput = {
  organizationSlug: string;
  projectSlug: string;
  sessionId: string;
  currentPageTitle?: string;
  currentPagePath?: string;
  messages: UIMessage[];
};

type PublicChatMessage = UIMessage<
  unknown,
  {
    progress: {
      step: number;
      label: string;
    };
  }
>;

export const Route = createFileRoute("/api/ai/public-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentLength = Number(
            request.headers.get("content-length") || 0,
          );
          if (contentLength > MAX_REQUEST_BYTES) {
            return json({ error: "Request input is too large" }, 413);
          }

          const input = (await request.json()) as Partial<PublicChatInput>;
          if (!isValidPublicChatInput(input)) {
            return json({ error: "Invalid chat request" }, 400);
          }

          assertGatewayConfigured();

          const stream = createUIMessageStream<PublicChatMessage>({
            execute: async ({ writer }) => {
              writeProgress(writer, 0, "Searching documentation");

              const client = getConvexClient();
              const [settings, data] = await Promise.all([
                client.query(api.ai.getPublicSettingsBySlug, {
                  organizationSlug: input.organizationSlug,
                  projectSlug: input.projectSlug,
                }),
                client.query(api.ai.getPublicProjectContextBySlug, {
                  organizationSlug: input.organizationSlug,
                  projectSlug: input.projectSlug,
                }),
              ]);

              if (!settings || !data) {
                throw new Error("Public project not found");
              }
              if (!settings.enabled) {
                throw new Error("AI assistant is disabled");
              }
              if (settings.providerMode !== "gateway") {
                throw new Error(
                  "This AI provider mode is configured but public execution is currently wired for Vercel AI Gateway",
                );
              }

              const messages = input.messages.slice(-MAX_MESSAGES);
              const publicDocsBasePath = new URL(request.url).origin;

              const modelMessages = await convertToModelMessages(messages);
              const loadedPages = new Set<string>();
              const loadedDocuments: Array<Record<string, unknown>> = [];
              const loadedSources = new Map<
                string,
                { title: string; url: string }
              >();
              const systemPrompt = buildRetrievalSystemPrompt({
                project: data.project,
                currentPageTitle: input.currentPageTitle,
                currentPagePath: input.currentPagePath,
              });
              await generateText({
                model: settings.model,
                system: `${systemPrompt}

Retrieval phase:
- Use the tools to gather only the documentation needed for the user's latest question.
- Do not write the final answer in this phase.`,
                messages: modelMessages,
                temperature: 0.2,
                tools: {
                  searchDocumentation: tool({
                    description:
                      "Search the project's guides and API reference. Use this before loading pages for broad or cross-page questions.",
                    inputSchema: z.object({
                      query: z.string().min(1).max(300),
                    }),
                    execute: async ({ query }) => {
                      writeProgress(writer, 0, "Searching documentation");
                      return searchDocumentation({
                        data,
                        query,
                        publicDocsBasePath,
                      });
                    },
                  }),
                  getDocumentationPage: tool({
                    description:
                      "Load one documentation page selected from search results.",
                    inputSchema: z.object({
                      type: z.enum(["guide", "reference"]),
                      slug: z.string().min(1).max(200),
                    }),
                    execute: async ({ type, slug }) => {
                      writeProgress(writer, 1, "Reading documentation page");
                      const key = `${type}:${slug}`;
                      if (!loadedPages.has(key) && loadedPages.size >= 4) {
                        return {
                          error:
                            "Page retrieval limit reached. Answer using the pages already loaded.",
                        };
                      }
                      loadedPages.add(key);
                      const page = getDocumentationPage({
                        data,
                        type,
                        slug,
                        publicDocsBasePath,
                      });
                      if (page) {
                        loadedDocuments.push(page);
                        loadedSources.set(page.source.url, page.source);
                      }
                      return page;
                    },
                  }),
                  getCurrentPage: tool({
                    description:
                      "Load the documentation page currently open in the user's browser.",
                    inputSchema: z.object({}),
                    execute: async () => {
                      writeProgress(writer, 1, "Reading current page");
                      if (
                        input.currentPagePath &&
                        !loadedPages.has(input.currentPagePath) &&
                        loadedPages.size >= 4
                      ) {
                        return {
                          error:
                            "Page retrieval limit reached. Answer using the pages already loaded.",
                        };
                      }
                      if (input.currentPagePath) {
                        loadedPages.add(input.currentPagePath);
                      }
                      const page = getCurrentDocumentationPage({
                        data,
                        currentPagePath: input.currentPagePath,
                        publicDocsBasePath,
                      });
                      if (page) {
                        loadedDocuments.push(page);
                        loadedSources.set(page.source.url, page.source);
                      }
                      return page;
                    },
                  }),
                },
                stopWhen: stepCountIs(3),
              });

              if (loadedDocuments.length === 0) {
                writeProgress(writer, 1, "Reading relevant documentation");
                const fallback =
                  getCurrentDocumentationPage({
                    data,
                    currentPagePath: input.currentPagePath,
                    publicDocsBasePath,
                  }) ??
                  (() => {
                    const result = searchDocumentation({
                      data,
                      query: getLatestUserText(messages),
                      publicDocsBasePath,
                    })[0];
                    return result
                      ? getDocumentationPage({
                          data,
                          type: result.type,
                          slug: result.slug,
                          publicDocsBasePath,
                        })
                      : null;
                  })();
                if (fallback) {
                  loadedDocuments.push(fallback);
                  loadedSources.set(fallback.source.url, fallback.source);
                }
              }

              writeProgress(writer, 2, "Preparing an answer");

              for (const source of loadedSources.values()) {
                writer.write({
                  type: "source-url",
                  sourceId: source.url,
                  url: source.url,
                  title: source.title,
                });
              }

              writeProgress(writer, 3, "Writing the response");
              const result = streamText({
                model: settings.model,
                system: `${systemPrompt}

Loaded documentation:
${JSON.stringify(loadedDocuments)}

Write the complete user-facing answer now. Tools are not available. Do not emit tool calls, XML, DSML, function syntax, or internal reasoning.`,
                messages: modelMessages,
                temperature: 0.2,
                onFinish: async ({ text }) => {
                  const safeText = sanitizeAiResponseText(text);
                  await client.mutation(api.ai.recordPublicConversation, {
                    projectId: data.project._id,
                    sessionId: input.sessionId,
                    providerMode: settings.providerMode,
                    provider: settings.provider,
                    model: settings.model,
                    messages: [
                      ...messages.map((message) => ({
                        role:
                          message.role === "assistant"
                            ? ("assistant" as const)
                            : ("user" as const),
                        content: getMessageText(message),
                        createdAt: Date.now(),
                      })),
                      {
                        role: "assistant" as const,
                        content: safeText,
                        createdAt: Date.now(),
                      },
                    ].filter((message) => message.content.trim()),
                  });
                },
              });

              writer.merge(result.toUIMessageStream<PublicChatMessage>());
            },
            onError: (error) =>
              error instanceof Error ? error.message : "AI request failed",
          });

          return createUIMessageStreamResponse({ stream });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "AI request failed";
          return json({ error: message }, 500);
        }
      },
    },
  },
});

function writeProgress(
  writer: Parameters<
    Parameters<typeof createUIMessageStream<PublicChatMessage>>[0]["execute"]
  >[0]["writer"],
  step: number,
  label: string,
) {
  writer.write({
    type: "data-progress",
    data: { step, label },
    transient: true,
  });
}

function getConvexClient() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("VITE_CONVEX_URL is not configured");
  return new ConvexHttpClient(convexUrl);
}

function assertGatewayConfigured() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }
}

function isValidPublicChatInput(
  input: Partial<PublicChatInput>,
): input is PublicChatInput {
  return Boolean(
    input.organizationSlug &&
      input.projectSlug &&
      input.sessionId &&
      Array.isArray(input.messages),
  );
}

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
}

function getLatestUserText(messages: UIMessage[]) {
  const latest = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  return latest ? getMessageText(latest) : "";
}

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
