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
  updatedAt?: number;
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
  updatedAt?: number;
};

/**
 * Formats an API endpoint into a Markdown export page.
 *
 * @param options - Function options.
 * @param options.endpoint - Endpoint data used by the operation.
 * @param options.baseUrl - API base URL.
 * @returns Result produced by the function.
 */
export const formatEndpointMarkdown = ({
  endpoint,
  baseUrl,
}: {
  endpoint: ExportEndpoint;
  baseUrl: string;
}) => {
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
  const requestUrl = buildDocumentationRequestUrl(baseUrl, endpoint.body.path);
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
};

/**
 * Formats a guide page into a Markdown export page.
 *
 * @param options - Function options.
 * @param options.guide - Guide page data used by the operation.
 * @returns Result produced by the function.
 */
export const formatGuideMarkdown = ({ guide }: { guide: ExportGuidePage }) => {
  return normalizeMarkdown([
    `# ${guide.title}`,
    guide.description,
    contentToMarkdown(guide.markdown, guide.content),
  ]);
};

/**
 * Converts stored rich-text content fields into Markdown text.
 *
 * @param [markdown] - Preferred Markdown source when already available.
 * @param [content] - Serialized rich-text JSON content used as a fallback source.
 * @returns Result produced by the function.
 */
export const contentToMarkdown = (markdown?: string, content?: string) => {
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
};

/**
 * Formats endpoint authentication notes for Markdown output.
 *
 * @param authHeader - Value supplied to the helper.
 * @returns Markdown authentication section, or undefined when omitted.
 */
const formatAuthentication = (
  authHeader: ExportEndpoint["body"]["authHeader"],
) => {
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
};

/**
 * Formats a Markdown table for documented fields.
 *
 * @param title - Section or group title.
 * @param fields - Field definitions to inspect.
 * @returns Markdown table section, or undefined when no fields exist.
 */
const formatFieldTable = (title: string, fields: ExportField[]) => {
  if (!fields.length) return "";

  return section(
    title,
    [
      "| Name | Type | Required | Description |",
      "|---|---|---:|---|",
      ...fields.flatMap((field) => formatFieldRows(field)),
    ].join("\n"),
  );
};

/**
 * Formats Markdown table rows for one field and its children.
 *
 * @param field - Field definition to convert.
 * @param [prefix=""] - Field path prefix used for nested fields.
 * @returns Markdown table rows.
 */
const formatFieldRows = (field: ExportField, prefix = ""): string[] => {
  const name = prefix ? `${prefix}.${field.name}` : field.name;
  return [
    `| ${escapeTableCell(name)} | ${escapeTableCell(
      field.dataType,
    )} | ${field.required ? "Yes" : "No"} | ${escapeTableCell(
      field.description || "—",
    )} |`,
    ...(field.fields ?? []).flatMap((child) => formatFieldRows(child, name)),
  ];
};

/**
 * Formats endpoint sample responses for Markdown or AI context.
 *
 * @param responses - Response examples to format.
 * @returns Formatted response text.
 */
const formatResponses = (
  responses: ExportEndpoint["body"]["sampleResponses"],
) => {
  if (!responses.length) return "";

  return section(
    "Responses",
    responses
      .map((response) =>
        normalizeMarkdown([
          `### ${response.statusCode}`,
          response.description,
          response.body
            ? fenced(detectCodeLanguage(response.body), response.body)
            : "",
        ]),
      )
      .join("\n\n"),
  );
};

/**
 * Formats an optional Markdown section.
 *
 * @param title - Section or group title.
 * @param [body] - Value supplied to the helper.
 * @returns Markdown section, or undefined when body is empty.
 */
const section = (title: string, body?: string) => {
  const content = body?.trim();
  if (!content) return "";
  return `## ${title}\n\n${content}`;
};

/**
 * Formats a fenced Markdown code block.
 *
 * @param language - Code fence language.
 * @param code - Code content for the fence.
 * @returns Fenced Markdown code block.
 */
const fenced = (language: string, code: string) => {
  return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
};

/**
 * Detects a code fence language for a sample response.
 *
 * @param value - Value to inspect or format.
 * @returns Detected code language.
 */
const detectCodeLanguage = (value: string) => {
  try {
    JSON.parse(value);
    return "json";
  } catch {
    return "txt";
  }
};

/**
 * Builds an example request URL for documentation output.
 *
 * @param baseUrl - Base URL used to build links.
 * @param path - Path value to append or normalize.
 * @returns Example request URL.
 */
const buildDocumentationRequestUrl = (baseUrl: string, path: string) => {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

/**
 * Escapes Markdown table cell content.
 *
 * @param value - Value to inspect or format.
 * @returns Escaped table cell string.
 */
const escapeTableCell = (value: string) => {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
};

/**
 * Joins Markdown sections while removing empty parts.
 *
 * @param parts - Markdown parts to join.
 * @returns Normalized Markdown document.
 */
const normalizeMarkdown = (parts: Array<string | undefined | null | false>) => {
  return `${parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n")}\n`;
};

/**
 * Normalizes whitespace in text extracted from rich-text content.
 *
 * @param value - Value to inspect or format.
 * @returns Whitespace-normalized text.
 */
const normalizeWhitespace = (value: string) => {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Removes HTML tags from serialized content.
 *
 * @param value - Value to inspect or format.
 * @returns Plain text with HTML removed.
 */
const stripHtml = (value: string) => {
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
};

type TipTapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: TipTapNode[];
};

/**
 * Converts a TipTap JSON node into Markdown.
 *
 * @param node - TipTap node to convert.
 * @returns Markdown text for the node.
 */
const tiptapNodeToMarkdown = (node: TipTapNode): string => {
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
        .map(
          (child, index) =>
            `${index + 1}. ${tiptapNodeToMarkdown(child).trim()}`,
        )
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
};

/**
 * Applies TipTap text marks to Markdown text.
 *
 * @param text - Text content to transform.
 * @param marks - TipTap marks to apply.
 * @returns Markdown text with marks applied.
 */
const applyMarks = (
  text: string,
  marks: Array<{ type?: string; attrs?: Record<string, unknown> }>,
) => {
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
};
