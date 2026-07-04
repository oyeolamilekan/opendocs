import { contentToMarkdown, type ExportField } from "./markdown-export";

export type AiProjectContextData = {
  project: {
    title: string;
    slug: string;
    baseUrl: string;
    description: string;
    visibility: "private" | "public";
  };
  apiSections: Array<{
    title: string;
    slug: string;
    endpoints: Array<{
      title: string;
      slug: string;
      endpointType: "endpoint" | "doc";
      content?: string;
      markdown?: string;
      body: {
        method: string;
        path: string;
        description: string;
        parameters: ExportField[];
        requestBody: ExportField[];
        authHeader: {
          type: "none" | "bearer" | "apiKey" | "basic";
          key: string;
          value?: string;
        };
        sampleResponses: Array<{
          statusCode: number;
          description: string;
          body: string;
        }>;
      };
    }>;
  }>;
  guideSections: Array<{
    title: string;
    slug: string;
    pages: Array<{
      title: string;
      slug: string;
      content?: string;
      markdown?: string;
      description: string;
    }>;
  }>;
};

const MAX_CONTEXT_CHARS = 14_000;
const MAX_SNIPPET_CHARS = 1_200;

/**
 * Builds the system prompt for project-aware AI documentation answers.
 *
 * @param options - Function options.
 * @param options.context - Prebuilt project context supplied to the assistant.
 * @returns Result produced by the function.
 */
export const buildAiSystemPrompt = ({ context }: { context: string }) => {
  return `You are the AI documentation assistant for this API project.

Rules:
- Answer using only the project documentation context provided below.
- If the context does not contain the answer, say that the documentation does not include enough information.
- Prefer concise, concrete answers.
- When relevant, include endpoint method and path.
- When linking to project documentation, use the normal docs page routes from context, not .md export routes.
- Never invent API keys, bearer tokens, credentials, request IDs, or production secrets.
- Authentication values in context are placeholders only.

Project documentation context:
${context}`;
};

/**
 * Builds compact project documentation context for AI retrieval and answer generation.
 *
 * @param options - Function options.
 * @param options.data - Documentation or project data consumed by the operation.
 * @param options.latestUserMessage - Latest user message used to rank relevant documentation.
 * @param options.publicDocsBasePath - Absolute public docs base path used to build source URLs.
 * @returns Result produced by the function.
 */
export const buildProjectAiContext = ({
  data,
  latestUserMessage,
  publicDocsBasePath,
}: {
  data: AiProjectContextData;
  latestUserMessage: string;
  publicDocsBasePath: string;
}) => {
  const candidates = [
    ...data.guideSections.flatMap((section) =>
      section.pages.map((page) => ({
        score: scoreText(latestUserMessage, [
          section.title,
          page.title,
          page.description,
          page.markdown ?? "",
          page.content ?? "",
        ]),
        text: formatGuideContext(section.title, page, publicDocsBasePath),
      })),
    ),
    ...data.apiSections.flatMap((section) =>
      section.endpoints.map((endpoint) => ({
        score: scoreText(latestUserMessage, [
          section.title,
          endpoint.title,
          endpoint.body.method,
          endpoint.body.path,
          endpoint.body.description,
          endpoint.markdown ?? "",
          endpoint.content ?? "",
        ]),
        text: formatEndpointContext(
          section.title,
          endpoint,
          publicDocsBasePath,
        ),
      })),
    ),
  ].sort((left, right) => right.score - left.score);

  const parts = [
    `# ${data.project.title}`,
    data.project.description,
    `Visibility: ${data.project.visibility}`,
    `API base URL: ${data.project.baseUrl}`,
    "",
    "## Most relevant documentation",
  ];

  for (const candidate of candidates) {
    const next = candidate.text.trim();
    if (!next) continue;
    const projected = `${parts.join("\n")}\n\n${next}`;
    if (projected.length > MAX_CONTEXT_CHARS && parts.length > 6) break;
    parts.push("", next);
  }

  if (parts.length <= 6) {
    parts.push("", "No guide pages or API endpoints are documented yet.");
  }

  return truncate(parts.join("\n"), MAX_CONTEXT_CHARS);
};

/**
 * Formats one guide page as compact AI context.
 *
 * @param sectionTitle - Value supplied to the helper.
 * @param page - Value supplied to the helper.
 * @param publicDocsBasePath - Value supplied to the helper.
 * @returns Formatted guide context text.
 */
const formatGuideContext = (
  sectionTitle: string,
  page: AiProjectContextData["guideSections"][number]["pages"][number],
  publicDocsBasePath: string,
) => {
  const body = contentToMarkdown(page.markdown, page.content);
  return [
    `### Guide: ${sectionTitle} / ${page.title}`,
    page.description ? `Description: ${page.description}` : "",
    `Docs page: ${publicDocsBasePath}/docs/${page.slug}`,
    body ? truncate(body, MAX_SNIPPET_CHARS) : "",
  ]
    .filter(Boolean)
    .join("\n");
};

/**
 * Formats one endpoint page as compact AI context.
 *
 * @param sectionTitle - Value supplied to the helper.
 * @param endpoint - Endpoint data used by the helper.
 * @param publicDocsBasePath - Value supplied to the helper.
 * @returns Formatted endpoint context text.
 */
const formatEndpointContext = (
  sectionTitle: string,
  endpoint: AiProjectContextData["apiSections"][number]["endpoints"][number],
  publicDocsBasePath: string,
) => {
  const isEndpoint = endpoint.endpointType === "endpoint";
  const notes = contentToMarkdown(endpoint.markdown, endpoint.content);

  return [
    `### ${isEndpoint ? "Endpoint" : "Reference page"}: ${sectionTitle} / ${endpoint.title}`,
    isEndpoint
      ? `Method/path: ${endpoint.body.method} ${endpoint.body.path}`
      : "",
    endpoint.body.description
      ? `Description: ${endpoint.body.description}`
      : "",
    formatAuth(endpoint.body.authHeader),
    formatFields("Parameters", endpoint.body.parameters),
    formatFields("Request body", endpoint.body.requestBody),
    formatResponses(endpoint.body.sampleResponses),
    `Docs page: ${publicDocsBasePath}/reference/${endpoint.slug}`,
    notes ? `Notes:\n${truncate(notes, MAX_SNIPPET_CHARS)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

/**
 * Formats endpoint authentication details for AI context.
 *
 * @param auth - Authentication configuration to summarize.
 * @returns Formatted authentication text.
 */
const formatAuth = (auth: {
  type: "none" | "bearer" | "apiKey" | "basic";
  key: string;
}) => {
  if (auth.type === "none") return "Authentication: none";
  const key =
    auth.key || (auth.type === "apiKey" ? "X-API-Key" : "Authorization");
  return `Authentication: ${auth.type}; header ${key}; value intentionally omitted`;
};

/**
 * Formats endpoint field definitions for AI context.
 *
 * @param title - Section or group title.
 * @param fields - Field definitions to inspect.
 * @returns Formatted field text.
 */
const formatFields = (title: string, fields: ExportField[]) => {
  if (!fields.length) return "";
  return `${title}:\n${fields
    .flatMap((field) => formatField(field))
    .join("\n")}`;
};

/**
 * Formats one endpoint field and its nested children.
 *
 * @param field - Field definition to convert.
 * @param [prefix=""] - Field path prefix used for nested fields.
 * @returns Formatted field lines.
 */
const formatField = (field: ExportField, prefix = ""): string[] => {
  const name = prefix ? `${prefix}.${field.name}` : field.name;
  return [
    `- ${name}: ${field.dataType}${field.required ? " required" : " optional"}${field.description ? ` — ${field.description}` : ""}`,
    ...(field.fields ?? []).flatMap((child) => formatField(child, name)),
  ];
};

/**
 * Formats endpoint sample responses for Markdown or AI context.
 *
 * @param responses - Response examples to format.
 * @returns Formatted response text.
 */
const formatResponses = (
  responses: AiProjectContextData["apiSections"][number]["endpoints"][number]["body"]["sampleResponses"],
) => {
  if (!responses.length) return "";
  return `Responses:\n${responses
    .map(
      (response) =>
        `- ${response.statusCode}: ${response.description}${
          response.body ? ` — example: ${truncate(response.body, 240)}` : ""
        }`,
    )
    .join("\n")}`;
};

/**
 * Scores text against a search query using deterministic token matching.
 *
 * @param query - Search query text.
 * @param values - Array values to inspect.
 * @returns Numeric relevance score.
 */
const scoreText = (query: string, values: string[]) => {
  const terms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9{}_/.-]+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2),
  );
  if (!terms.size) return 0;

  const haystack = values.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 1;
  }
  return score;
};

/**
 * Truncates long text to a bounded length.
 *
 * @param value - Value to inspect or format.
 * @param maxLength - Maximum output length.
 * @returns Original or truncated text.
 */
const truncate = (value: string, maxLength: number) => {
  const normalized = value.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 24).trimEnd()}\n...[truncated]`;
};
