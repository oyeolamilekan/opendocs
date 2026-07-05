import { useMemo, type MouseEventHandler } from "react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import HeadingExtension from "@tiptap/extension-heading";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/core";
import { PublicCodeTabs } from "./code-tabs";
import { prepareRichContent } from "../lib/rich-content";

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
