import { AI_GATEWAY_TEXT_MODELS } from "./ai-gateway-models";

export const AI_PROVIDER_MODES = [
  {
    value: "gateway",
    label: "Vercel AI Gateway",
    description: "Use the platform Gateway key and route requests through Vercel.",
  },
  {
    value: "ai-sdk",
    label: "AI SDK provider",
    description: "Use provider integrations through the Vercel AI SDK.",
  },
  {
    value: "native",
    label: "Native provider",
    description: "Use a direct provider implementation for this project.",
  },
] as const;

export const AI_PROVIDERS = [
  { value: "vercel", label: "Vercel Gateway" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "xai", label: "xAI" },
  { value: "groq", label: "Groq" },
  { value: "mistral", label: "Mistral" },
  { value: "custom", label: "Custom" },
] as const;

export const AI_MODEL_PRESETS: Record<AiProvider, string[]> = {
  vercel: [...AI_GATEWAY_TEXT_MODELS],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o4-mini"],
  anthropic: [
    "claude-sonnet-4.5",
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-latest",
  ],
  google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
  xai: ["grok-4", "grok-3", "grok-3-mini"],
  groq: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  mistral: ["mistral-large-latest", "codestral-latest"],
  custom: [],
};

export type AiProviderMode = (typeof AI_PROVIDER_MODES)[number]["value"];
export type AiProvider = (typeof AI_PROVIDERS)[number]["value"];
