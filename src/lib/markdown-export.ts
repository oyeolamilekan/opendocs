import { generateCodeExamples } from "./public-docs";

export type ExportField = {
  name: string;
  dataType: string;
  required: boolean;
  description: string;
  location?: string;
  fields?: ExportField[];
};

export type ExportEndpoint = {
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
};

export type ExportGuidePage = {
  title: string;
  slug: string;
  content?: string;
  markdown?: string;
  description: string;
};

export function formatEndpointMarkdown({
  endpoint,
  baseUrl,
}: {
  endpoint: ExportEndpoint;
  baseUrl: string;
}) {
  if (endpoint.endpointType === "doc") {
    return normalizeMarkdown([
      `# ${endpoint.title}`,
      endpoint.body.description,
      contentToMarkdown(endpoint.markdown, endpoint.content),
    ]);
  }

  const pathParameters = endpoint.body.parameters.filter(
    (parameter) => parameter.location === "path",
  );
  const queryParameters = endpoint.body.parameters.filter(
    (parameter) => parameter.location === "query",
  );
  const headerParameters = endpoint.body.parameters.filter(
    (parameter) => parameter.location === "header",
  );
  const otherParameters = endpoint.body.parameters.filter(
    (parameter) =>
      parameter.location !== "path" &&
      parameter.location !== "query" &&
      parameter.location !== "header",
  );
  const requestUrl = buildDocumentationRequestUrl(
    baseUrl,
    endpoint.body.path,
  );
  const codeExamples = generateCodeExamples({
    method: endpoint.body.method,
    url: requestUrl,
    authType: endpoint.body.authHeader.type,
    authKey: endpoint.body.authHeader.key,
    hasBody: endpoint.body.requestBody.length > 0,
  });

  return normalizeMarkdown([
    `# ${endpoint.title}`,
    `${endpoint.body.method} ${endpoint.body.path}`,
    section("Description", endpoint.body.description),
    section("Base URL", baseUrl),
    formatAuthentication(endpoint.body.authHeader),
    formatFieldTable("Path parameters", pathParameters),
    formatFieldTable("Query parameters", queryParameters),
    formatFieldTable("Headers", headerParameters),
    formatFieldTable("Request parameters", otherParameters),
    formatFieldTable("Request body", endpoint.body.requestBody),
    formatResponses(endpoint.body.sampleResponses),
    section("Example request", fenced("bash", codeExamples.cURL)),
    contentToMarkdown(endpoint.markdown, endpoint.content)
      ? section(
          "Additional notes",
          contentToMarkdown(endpoint.markdown, endpoint.content),
        )
      : "",
  ]);
}

export function formatGuideMarkdown({ guide }: { guide: ExportGuidePage }) {
  return normalizeMarkdown([
    `# ${guide.title}`,
    guide.description,
    contentToMarkdown(guide.markdown, guide.content),
  ]);
}

export function contentToMarkdown(markdown?: string, content?: string) {
  if (markdown?.trim()) return normalizeWhitespace(markdown);
  if (!content?.trim()) return "";

  try {
    const parsed = JSON.parse(content) as TipTapNode;
    if (parsed?.type === "doc") {
      return normalizeWhitespace(tiptapNodeToMarkdown(parsed).trim());
    }
  } catch {
    // Stored legacy content may be plain text or HTML-ish content.
  }

  return normalizeWhitespace(stripHtml(content));
}

function formatAuthentication(authHeader: ExportEndpoint["body"]["authHeader"]) {
  if (authHeader.type === "none") return "";

  const key =
    authHeader.key ||
    (authHeader.type === "apiKey" ? "X-API-Key" : "Authorization");
  const value =
    authHeader.type === "bearer"
      ? "Bearer YOUR_TOKEN"
      : authHeader.type === "basic"
        ? "Basic YOUR_CREDENTIALS"
        : "YOUR_API_KEY";
  const label =
    authHeader.type === "apiKey"
      ? "API key authentication"
      : `${authHeader.type[0]?.toUpperCase()}${authHeader.type.slice(
          1,
        )} authentication`;

  return section(
    "Authentication",
    normalizeMarkdown([
      label,
      "Send credentials using this header:",
      fenced("txt", `${key}: ${value}`),
    ]),
  );
}

function formatFieldTable(title: string, fields: ExportField[]) {
  if (!fields.length) return "";

  return section(
    title,
    [
      "| Name | Type | Required | Description |",
      "|---|---|---:|---|",
      ...fields.flatMap((field) => formatFieldRows(field)),
    ].join("\n"),
  );
}

function formatFieldRows(field: ExportField, prefix = ""): string[] {
  const name = prefix ? `${prefix}.${field.name}` : field.name;
  return [
    `| ${escapeTableCell(name)} | ${escapeTableCell(
      field.dataType,
    )} | ${field.required ? "Yes" : "No"} | ${escapeTableCell(
      field.description || "—",
    )} |`,
    ...(field.fields ?? []).flatMap((child) => formatFieldRows(child, name)),
  ];
}

function formatResponses(
  responses: ExportEndpoint["body"]["sampleResponses"],
) {
  if (!responses.length) return "";

  return section(
    "Responses",
    responses
      .map((response) =>
        normalizeMarkdown([
          `### ${response.statusCode}`,
          response.description,
          response.body ? fenced(detectCodeLanguage(response.body), response.body) : "",
        ]),
      )
      .join("\n\n"),
  );
}

function section(title: string, body?: string) {
  const content = body?.trim();
  if (!content) return "";
  return `## ${title}\n\n${content}`;
}

function fenced(language: string, code: string) {
  return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
}

function detectCodeLanguage(value: string) {
  try {
    JSON.parse(value);
    return "json";
  } catch {
    return "txt";
  }
}

function buildDocumentationRequestUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function escapeTableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function normalizeMarkdown(parts: Array<string | undefined | null | false>) {
  return `${parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n")}\n`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type TipTapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: TipTapNode[];
};

function tiptapNodeToMarkdown(node: TipTapNode): string {
  const children = (node.content ?? []).map(tiptapNodeToMarkdown).join("");

  switch (node.type) {
    case "doc":
      return (node.content ?? [])
        .map(tiptapNodeToMarkdown)
        .filter(Boolean)
        .join("\n\n");
    case "paragraph":
      return children.trim();
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      return `${"#".repeat(Math.min(Math.max(level, 1), 6))} ${children.trim()}`;
    }
    case "text":
      return applyMarks(node.text ?? "", node.marks ?? []);
    case "bulletList":
      return (node.content ?? [])
        .map((child) => `- ${tiptapNodeToMarkdown(child).trim()}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((child, index) => `${index + 1}. ${tiptapNodeToMarkdown(child).trim()}`)
        .join("\n");
    case "listItem":
      return children.trim();
    case "blockquote":
      return children
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "codeBlock":
      return fenced(String(node.attrs?.language ?? ""), children);
    case "hardBreak":
      return "\n";
    case "horizontalRule":
      return "---";
    case "image": {
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      return src ? `![${alt}](${src})` : "";
    }
    case "table":
      return (node.content ?? []).map(tiptapNodeToMarkdown).join("\n");
    case "tableRow":
      return `| ${(node.content ?? [])
        .map((cell) => tiptapNodeToMarkdown(cell).trim())
        .join(" | ")} |`;
    case "tableCell":
    case "tableHeader":
      return children.trim().replaceAll("\n", "<br>");
    default:
      return children;
  }
}

function applyMarks(
  text: string,
  marks: Array<{ type?: string; attrs?: Record<string, unknown> }>,
) {
  return marks.reduce((value, mark) => {
    if (mark.type === "bold") return `**${value}**`;
    if (mark.type === "italic") return `_${value}_`;
    if (mark.type === "code") return `\`${value}\``;
    if (mark.type === "strike") return `~~${value}~~`;
    if (mark.type === "link") {
      const href = String(mark.attrs?.href ?? "");
      return href ? `[${value}](${href})` : value;
    }
    return value;
  }, text);
}
