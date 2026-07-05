import type { JSONContent } from "@tiptap/core";

export type RichContentHeading = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

function parseTipTapJSON(value: unknown): JSONContent | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const isValid =
      parsed.type === "doc" &&
      Array.isArray(parsed.content) &&
      parsed.content.every(
        (node: unknown) =>
          node !== null &&
          typeof node === "object" &&
          typeof (node as Record<string, unknown>).type === "string",
      );
    return isValid ? (parsed as JSONContent) : null;
  } catch {
    return null;
  }
}

function getNodeText(node: JSONContent): string {
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  if (!Array.isArray(node.content)) return "";
  return node.content.map(getNodeText).join("");
}

function getHeadingLevel(node: JSONContent): 1 | 2 | 3 | null {
  const level = node.attrs?.level;
  return level === 1 || level === 2 || level === 3 ? level : null;
}

function createHeadingSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

function uniqueHeadingId(value: string, seen: Map<string, number>) {
  const slug = createHeadingSlug(value);
  const count = (seen.get(slug) ?? 0) + 1;
  seen.set(slug, count);
  return count === 1 ? slug : `${slug}-${count}`;
}

function addHeadingIds(
  node: JSONContent,
  headings: RichContentHeading[],
  seen: Map<string, number>,
): JSONContent {
  const level = node.type === "heading" ? getHeadingLevel(node) : null;
  const text = level ? getNodeText(node).trim().replace(/\s+/g, " ") : "";

  const content = Array.isArray(node.content)
    ? node.content.map((child) => addHeadingIds(child, headings, seen))
    : node.content;

  if (!level || !text) {
    return content ? { ...node, content } : { ...node };
  }

  const id = uniqueHeadingId(text, seen);
  headings.push({ id, text, level });

  return {
    ...node,
    attrs: {
      ...node.attrs,
      id,
    },
    ...(content ? { content } : {}),
  };
}

export function prepareRichContent(content: string | null | undefined) {
  const document = parseTipTapJSON(content);
  if (!document) return null;

  const headings: RichContentHeading[] = [];
  const seen = new Map<string, number>();
  const preparedContent = (document.content ?? []).map((node) =>
    addHeadingIds(node, headings, seen),
  );

  return {
    document: { ...document, content: preparedContent },
    headings,
  };
}

export function extractRichContentHeadings(content: string | null | undefined) {
  return prepareRichContent(content)?.headings ?? [];
}
