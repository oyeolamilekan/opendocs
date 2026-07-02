import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { buildPublicDocumentationUrl } from "../../../lib/public-docs-domain";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { decryptAiApiKey } from "../../../lib/ai-key-encryption.server";
import { fetchAuthQuery } from "../../../lib/auth-server";
import {
  buildFinalAnswerPrompt,
  buildRetrievalSystemPrompt,
  getDocumentationPage,
  searchDocumentation,
} from "../../../lib/ai-document-retrieval";

const MAX_REQUEST_BYTES = 128 * 1024;
const MAX_MESSAGES = 12;

type ChatInput = {
  projectId: Id<"apiProjects">;
  organizationSlug: string;
  projectSlug: string;
  messages: UIMessage[];
};

export const Route = createFileRoute("/api/ai/chat")({
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

          const input = (await request.json()) as Partial<ChatInput>;
          if (!isValidChatInput(input)) {
            return json({ error: "Invalid chat request" }, 400);
          }

          const messages = input.messages.slice(-MAX_MESSAGES);
          const [data, runtime] = await Promise.all([
            fetchAuthQuery(api.ai.getProjectContext, {
              projectId: input.projectId,
            }),
            fetchAuthQuery(api.ai.getRuntimeSettings, {
              projectId: input.projectId,
            }),
          ]);
          validateRuntime(runtime);
          if (runtime.publicSettings.providerMode === "gateway") {
            assertGatewayConfigured();
          }
          const requestUrl = new URL(request.url);
          const publicDocsBasePath = buildPublicDocumentationUrl({
            projectSlug: input.projectSlug,
            protocol: requestUrl.protocol.replace(":", ""),
            host: requestUrl.host,
          }).replace(/\/$/, "");
          const loadedPages = new Set<string>();
          const systemPrompt = buildRetrievalSystemPrompt({
            project: data.project,
          });
          const result = streamText({
            model: runtime.publicSettings.model,
            system: systemPrompt,
            messages: await convertToModelMessages(messages),
            temperature: 0.2,
            tools: {
              searchDocumentation: tool({
                description:
                  "Search the project's guides and API reference. Use this before loading pages.",
                inputSchema: z.object({
                  query: z.string().min(1).max(300),
                }),
                execute: async ({ query }) =>
                  searchDocumentation({
                    data,
                    query,
                    publicDocsBasePath,
                  }),
              }),
              getDocumentationPage: tool({
                description:
                  "Load one documentation page selected from search results.",
                inputSchema: z.object({
                  type: z.enum(["guide", "reference"]),
                  slug: z.string().min(1).max(200),
                }),
                execute: async ({ type, slug }) => {
                  const key = `${type}:${slug}`;
                  if (!loadedPages.has(key) && loadedPages.size >= 4) {
                    return {
                      error:
                        "Page retrieval limit reached. Answer using the pages already loaded.",
                    };
                  }
                  loadedPages.add(key);
                  return getDocumentationPage({
                    data,
                    type,
                    slug,
                    publicDocsBasePath,
                  });
                },
              }),
            },
            stopWhen: stepCountIs(4),
            prepareStep: ({ stepNumber }) =>
              stepNumber >= 3
                ? {
                    activeTools: [],
                    toolChoice: "none",
                    system: buildFinalAnswerPrompt(systemPrompt),
                  }
                : undefined,
          });

          return result.toUIMessageStreamResponse();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "AI request failed";
          const status =
            message.includes("Authentication") ||
            message.includes("membership") ||
            message.includes("not found")
              ? 403
              : 500;
          return json({ error: message }, status);
        }
      },
    },
  },
});

function assertGatewayConfigured() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is not configured");
  }
}

function validateRuntime(runtime: {
  publicSettings: { providerMode: string };
  settings: { encryptedApiKey?: string } | null;
}) {
  if (runtime.publicSettings.providerMode === "gateway") return;

  if (!runtime.settings?.encryptedApiKey) {
    throw new Error("A provider API key is required for this AI provider mode");
  }

  decryptAiApiKey(runtime.settings.encryptedApiKey);
  throw new Error(
    "This provider mode is configured, but only Vercel AI Gateway execution is currently wired for chat responses",
  );
}

function isValidChatInput(input: Partial<ChatInput>): input is ChatInput {
  return Boolean(
    input.projectId &&
      input.organizationSlug &&
      input.projectSlug &&
      Array.isArray(input.messages),
  );
}

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
