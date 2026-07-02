import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  createApiKeyHint,
  encryptAiApiKey,
} from "../../../lib/ai-key-encryption.server";
import { fetchAuthMutation } from "../../../lib/auth-server";

const settingsInputSchema = z.object({
  projectId: z.string().min(1),
  enabled: z.boolean(),
  providerMode: z.enum(["gateway", "ai-sdk", "native"]),
  provider: z.enum([
    "vercel",
    "openai",
    "anthropic",
    "google",
    "xai",
    "groq",
    "mistral",
    "custom",
  ]),
  model: z.string().trim().min(1).max(200),
  displayName: z.string().trim().max(80).optional(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional(),
});

export const Route = createFileRoute("/api/ai/settings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = settingsInputSchema.parse(await request.json());
          const apiKey = input.apiKey?.trim();
          const encryptedApiKey = apiKey ? encryptAiApiKey(apiKey) : undefined;
          const apiKeyHint = apiKey ? createApiKeyHint(apiKey) : undefined;

          const settings = await fetchAuthMutation(api.ai.updateSettings, {
            projectId: input.projectId as Id<"apiProjects">,
            enabled: input.enabled,
            providerMode: input.providerMode,
            provider: input.provider,
            model: input.model,
            displayName: input.displayName ?? "",
            encryptedApiKey,
            apiKeyHint,
            clearApiKey: input.clearApiKey,
          });

          return json({ settings }, 200);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to save settings";
          return json({ error: message }, 400);
        }
      },
    },
  },
});

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
