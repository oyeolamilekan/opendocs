import { useMemo, type MouseEventHandler } from "react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import HeadingExtension from "@tiptap/extension-heading";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/core";
import { PublicCodeTabs } from "./code-tabs";

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

const htmlExtensions = [
  StarterKit.configure({
    heading: false,
    link: false,
  }),
  HeadingExtension.extend({
    addAttributes() {
      return {
        ...(this.parent?.() ?? {}),
        id: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute("id"),
          renderHTML: (attributes: Record<string, unknown>) =>
            attributes.id ? { id: String(attributes.id) } : {},
        },
      };
    },
  }).configure({ levels: [1, 2, 3] }),
  LinkExtension.configure({
    HTMLAttributes: { class: "underline text-primary" },
  }),
  ImageExtension.configure({
    allowBase64: false,
    HTMLAttributes: {
      class: "documentation-image",
      loading: "lazy",
    },
  }),
  TableKit.configure({
    table: {
      renderWrapper: true,
      HTMLAttributes: {
        class: "documentation-table",
      },
    },
  }),
];

function renderTipTapHTML(content: JSONContent[]): string {
  try {
    return generateHTML({ type: "doc", content }, htmlExtensions);
  } catch {
    return "";
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

export function RichContentRenderer({
  content,
  className,
  onClickCapture,
}: {
  content: string | null | undefined;
  className?: string;
  onClickCapture?: MouseEventHandler<HTMLDivElement>;
}) {
  const blocks = useMemo(() => {
    if (!content) return null;
    const prepared = prepareRichContent(content);
    if (!prepared) return null;

    const result: Array<
      | { type: "html"; html: string }
      | { type: "codeTabs"; tabs: unknown }
    > = [];
    let pending: JSONContent[] = [];

    function flushHTML() {
      if (pending.length === 0) return;
      const html = renderTipTapHTML(pending);
      if (html) result.push({ type: "html", html });
      pending = [];
    }

    for (const node of prepared.document.content ?? []) {
      if (node.type === "codeTabs") {
        flushHTML();
        result.push({ type: "codeTabs", tabs: node.attrs?.tabs });
      } else {
        pending.push(node);
      }
    }
    flushHTML();
    return result;
  }, [content]);

  if (!content) return null;

  if (blocks) {
    return (
      <div
        className={`prose prose-neutral max-w-none dark:prose-invert ${className ?? ""}`}
        onClickCapture={onClickCapture}
      >
        {blocks.map((block, index) =>
          block.type === "codeTabs" ? (
            <PublicCodeTabs key={index} tabs={block.tabs} />
          ) : (
            <div
              key={index}
              className="rich-content-segment"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          ),
        )}
      </div>
    );
  }

  return <p className={className}>{content}</p>;
}
