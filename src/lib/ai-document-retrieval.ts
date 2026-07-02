import { contentToMarkdown } from "./markdown-export";
import type { AiProjectContextData } from "./ai-project-context";

export type DocumentationSource = {
  title: string;
  url: string;
  type: "guide" | "reference";
};

type DocumentationEntry = DocumentationSource & {
  slug: string;
  sectionTitle: string;
  description: string;
  searchableText: string;
};

const MAX_SEARCH_RESULTS = 5;
const MAX_PAGE_CHARS = 6_000;

export function buildRetrievalSystemPrompt({
  project,
  currentPageTitle,
  currentPagePath,
}: {
  project: AiProjectContextData["project"];
  currentPageTitle?: string;
  currentPagePath?: string;
}) {
  return `You are the AI documentation assistant for ${project.title}.

Project summary: ${project.description || "No project description provided."}
API base URL: ${project.baseUrl}
Current page: ${currentPageTitle || "unknown"} (${currentPagePath || "unknown"})

Rules:
- Answer only from documentation returned by the provided tools.
- Use getCurrentPage for questions about the page the user is viewing.
- Use searchDocumentation before getDocumentationPage for broader questions.
- Never answer from search results alone; load every page used in the answer.
- Load only pages needed to answer; do not retrieve unrelated results.
- If the tools do not contain enough information, say so.
- Prefer concise, concrete answers and include endpoint method/path when relevant.
- Cite documentation inline next to the relevant statement using Markdown links in the form [Page title](complete absolute URL).
- Use the complete absolute URL exactly as returned by the page tool; never shorten it or use a relative path.
- Do not add a separate Sources section because the interface also displays the referenced pages.
- Never invent credentials, tokens, request IDs, or undocumented behavior.`;
}

export function buildFinalAnswerPrompt(basePrompt: string) {
  return `${basePrompt}

Final response step:
- Tools are no longer available.
- Write the complete user-facing answer now using only the documentation already loaded.
- Do not emit tool calls, XML, DSML, function syntax, or internal reasoning.`;
}

export function sanitizeAiResponseText(value: string) {
  return value
    .split("\n")
    .filter(
      (line) =>
        !/\bDSML\b/i.test(line) &&
        !/<\/?\s*(tool_calls?|invoke|parameter)\b/i.test(line),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function searchDocumentation({
  data,
  query,
  publicDocsBasePath,
}: {
  data: AiProjectContextData;
  query: string;
  publicDocsBasePath: string;
}) {
  return documentationEntries(data, publicDocsBasePath)
    .map((entry) => ({
      entry,
      score: scoreText(query, entry.searchableText),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.entry.title.localeCompare(right.entry.title),
    )
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({ entry }) => ({
      title: entry.title,
      section: entry.sectionTitle,
      type: entry.type,
      slug: entry.slug,
      description: entry.description,
      url: entry.url,
    }));
}

export function getDocumentationPage({
  data,
  type,
  slug,
  publicDocsBasePath,
}: {
  data: AiProjectContextData;
  type: DocumentationSource["type"];
  slug: string;
  publicDocsBasePath: string;
}) {
  if (type === "guide") {
    for (const section of data.guideSections) {
      const page = section.pages.find((candidate) => candidate.slug === slug);
      if (!page) continue;
      const source = guideSource(page.title, page.slug, publicDocsBasePath);
      return {
        source,
        section: section.title,
        description: page.description,
        content: truncate(
          contentToMarkdown(page.markdown, page.content),
          MAX_PAGE_CHARS,
        ),
      };
    }
    return null;
  }

  for (const section of data.apiSections) {
    const endpoint = section.endpoints.find(
      (candidate) => candidate.slug === slug,
    );
    if (!endpoint) continue;
    const source = referenceSource(
      endpoint.title,
      endpoint.slug,
      publicDocsBasePath,
    );
    return {
      source,
      section: section.title,
      endpointType: endpoint.endpointType,
      method: endpoint.body.method,
      path: endpoint.body.path,
      description: endpoint.body.description,
      authentication:
        endpoint.body.authHeader.type === "none"
          ? { type: "none" }
          : {
              type: endpoint.body.authHeader.type,
              header:
                endpoint.body.authHeader.key ||
                (endpoint.body.authHeader.type === "apiKey"
                  ? "X-API-Key"
                  : "Authorization"),
              value: "intentionally omitted",
            },
      parameters: flattenFields(endpoint.body.parameters).slice(0, 40),
      requestBody: flattenFields(endpoint.body.requestBody).slice(0, 60),
      responses: endpoint.body.sampleResponses.slice(0, 8).map((response) => ({
        statusCode: response.statusCode,
        description: response.description,
        body: truncate(response.body, 600),
      })),
      notes: truncate(
        contentToMarkdown(endpoint.markdown, endpoint.content),
        MAX_PAGE_CHARS,
      ),
    };
  }

  return null;
}

export function getCurrentDocumentationPage({
  data,
  currentPagePath,
  publicDocsBasePath,
}: {
  data: AiProjectContextData;
  currentPagePath?: string;
  publicDocsBasePath: string;
}) {
  const match = currentPagePath?.match(/^\/(docs|guides|reference)\/([^/?#]+)/);
  if (!match) return null;
  return getDocumentationPage({
    data,
    type: match[1] === "reference" ? "reference" : "guide",
    slug: decodeURIComponent(match[2]),
    publicDocsBasePath,
  });
}

export function getDocumentationSources(message: {
  parts?: Array<unknown>;
}) {
  const sources = new Map<string, DocumentationSource>();
  for (const part of message.parts ?? []) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    if (
      record.type === "source-url" &&
      typeof record.url === "string" &&
      /^https?:\/\//.test(record.url)
    ) {
      sources.set(record.url, {
        title:
          typeof record.title === "string" ? record.title : record.url,
        url: record.url,
        type: /\/(?:docs|guides)\//.test(new URL(record.url).pathname)
          ? "guide"
          : "reference",
      });
      continue;
    }
    const partType = typeof record.type === "string" ? record.type : "";
    if (
      !partType.includes("getDocumentationPage") &&
      !partType.includes("getCurrentPage")
    ) {
      continue;
    }
    collectSources(record.output, sources);
  }
  return [...sources.values()];
}

function documentationEntries(
  data: AiProjectContextData,
  publicDocsBasePath: string,
) {
  return [
    ...data.guideSections.flatMap((section) =>
      section.pages.map((page): DocumentationEntry => ({
        ...guideSource(page.title, page.slug, publicDocsBasePath),
        slug: page.slug,
        sectionTitle: section.title,
        description: page.description,
        searchableText: [
          section.title,
          page.title,
          page.description,
          page.markdown ?? "",
          page.content ?? "",
        ].join(" "),
      })),
    ),
    ...data.apiSections.flatMap((section) =>
      section.endpoints.map((endpoint): DocumentationEntry => ({
        ...referenceSource(
          endpoint.title,
          endpoint.slug,
          publicDocsBasePath,
        ),
        slug: endpoint.slug,
        sectionTitle: section.title,
        description: endpoint.body.description,
        searchableText: [
          section.title,
          endpoint.title,
          endpoint.body.method,
          endpoint.body.path,
          endpoint.body.description,
          endpoint.markdown ?? "",
          endpoint.content ?? "",
          endpoint.body.parameters.map((field) => field.name).join(" "),
          endpoint.body.requestBody.map((field) => field.name).join(" "),
        ].join(" "),
      })),
    ),
  ];
}

function guideSource(
  title: string,
  slug: string,
  publicDocsBasePath: string,
): DocumentationSource {
  return {
    title,
    type: "guide",
    url: `${publicDocsBasePath}/docs/${slug}`,
  };
}

function referenceSource(
  title: string,
  slug: string,
  publicDocsBasePath: string,
): DocumentationSource {
  return {
    title,
    type: "reference",
    url: `${publicDocsBasePath}/reference/${slug}`,
  };
}

function flattenFields(
  fields: AiProjectContextData["apiSections"][number]["endpoints"][number]["body"]["requestBody"],
  prefix = "",
): Array<{
  name: string;
  dataType: string;
  required: boolean;
  description: string;
}> {
  return fields.flatMap((field) => {
    const name = prefix ? `${prefix}.${field.name}` : field.name;
    return [
      {
        name,
        dataType: field.dataType,
        required: field.required,
        description: field.description,
      },
      ...flattenFields(field.fields ?? [], name),
    ];
  });
}

function scoreText(query: string, searchableText: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;
  const haystack = searchableText.toLowerCase();
  const terms = normalizedQuery
    .split(/[^a-z0-9{}_/.-]+/)
    .filter((term) => term.length > 2);
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    haystack.includes(normalizedQuery) ? 10 : 0,
  );
}

function collectSources(
  value: unknown,
  sources: Map<string, DocumentationSource>,
) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSources(item, sources));
    return;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.title === "string" &&
    typeof record.url === "string" &&
    (record.type === "guide" || record.type === "reference") &&
    /^https?:\/\//.test(record.url)
  ) {
    sources.set(record.url, {
      title: record.title,
      url: record.url,
      type: record.type,
    });
  }

  for (const nested of Object.values(record)) {
    collectSources(nested, sources);
  }
}

function truncate(value: string, maxLength: number) {
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 24).trimEnd()}\n...[truncated]`;
}
