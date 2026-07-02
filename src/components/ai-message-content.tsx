import { useRouter } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import {
  getDocumentationSources,
  sanitizeAiResponseText,
} from "../lib/ai-document-retrieval";
import { cn } from "../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type TextBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: number }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string; language?: string };

export function AiMessageContent({
  message,
  className,
}: {
  message: UIMessage;
  className?: string;
}) {
  const text = getMessageText(message);

  if (!text.trim()) {
    return <span className="text-muted-foreground">No text response.</span>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {parseTextBlocks(text).map((block, index) => (
        <MessageBlock key={`${message.id}-${index}`} block={block} />
      ))}
    </div>
  );
}

export function AiMessageReferences({ message }: { message: UIMessage }) {
  const sources = getDocumentationSources(message);
  if (!sources.length) return null;

  return (
    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">
        Referenced documentation
      </p>
      <ul className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <li key={source.url} className="min-w-0">
            <DocumentationAnchor
              href={source.url}
              className="flex min-w-0 flex-col text-xs text-primary underline decoration-current/40 underline-offset-4 hover:decoration-current"
            >
              <span className="font-medium">{source.title}</span>
              <span className="break-all text-[11px] text-muted-foreground">
                {source.url}
              </span>
            </DocumentationAnchor>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function getMessageText(message: UIMessage) {
  return sanitizeAiResponseText(
    message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n"),
  );
}

function MessageBlock({ block }: { block: TextBlock }) {
  if (block.type === "code") {
    return (
      <div className="max-w-full overflow-hidden rounded-xl border bg-background">
        {block.language ? (
          <div className="border-b bg-muted/50 px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {block.language}
          </div>
        ) : null}
        <pre className="max-w-full overflow-x-auto p-3.5 font-mono text-xs leading-5 text-foreground">
          <code>{block.text}</code>
        </pre>
      </div>
    );
  }

  if (block.type === "heading") {
    const HeadingTag =
      block.level <= 2 ? "h3" : block.level === 3 ? "h4" : "h5";
    return (
      <HeadingTag className="pt-1 text-[0.95rem] font-semibold leading-6 tracking-tight text-foreground first:pt-0">
        <InlineText text={block.text} />
      </HeadingTag>
    );
  }

  if (block.type === "unordered-list") {
    return (
      <ul className="ml-5 list-disc space-y-1.5 marker:text-muted-foreground">
        {block.items.map((item, index) => (
          <li key={index} className="pl-1">
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "ordered-list") {
    return (
      <ol className="ml-5 list-decimal space-y-1.5 marker:font-medium marker:text-muted-foreground">
        {block.items.map((item, index) => (
          <li key={index} className="pl-1">
            <InlineText text={item} />
          </li>
        ))}
      </ol>
    );
  }

  if (block.type === "table") {
    return (
      <Table
        containerClassName="max-w-full rounded-xl border"
        className="min-w-[32rem] border-collapse text-left"
      >
        <TableHeader className="bg-muted/50 text-foreground">
          <TableRow>
            {block.headers.map((header, index) => (
              <TableHead key={index} className="px-3 py-2.5 font-semibold">
                <InlineText text={header} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {block.headers.map((_, cellIndex) => (
                <TableCell
                  key={cellIndex}
                  className="px-3 py-2.5 align-top text-muted-foreground"
                >
                  <InlineText text={row[cellIndex] ?? ""} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <p className="whitespace-pre-wrap leading-6">
      <InlineText text={block.text} />
    </p>
  );
}

function InlineText({ text }: { text: string }) {
  return <MarkdownInlineText text={text} />;
}

function MarkdownInlineText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const inlinePattern =
    /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|(\*\*|__)(.+?)\4|(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)|(https?:\/\/[^\s<]+|\/docs\/[^\s<]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const codeText = match[1];
    const label = match[2];
    const href = match[3] ?? match[8];
    const strongText = match[5];
    const emphasisText = match[6] ?? match[7];

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (codeText !== undefined) {
      nodes.push(
        <code
          key={`code-${match.index}`}
          className="break-words rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[0.88em] text-foreground"
        >
          {codeText}
        </code>,
      );
      lastIndex = match.index + fullMatch.length;
      continue;
    }

    if (strongText !== undefined) {
      nodes.push(
        <strong key={`strong-${match.index}`} className="font-semibold">
          <InlineText text={strongText} />
        </strong>,
      );
      lastIndex = match.index + fullMatch.length;
      continue;
    }

    if (emphasisText !== undefined) {
      nodes.push(
        <em key={`em-${match.index}`}>
          <InlineText text={emphasisText} />
        </em>,
      );
      lastIndex = match.index + fullMatch.length;
      continue;
    }

    if (!href) {
      nodes.push(fullMatch);
      lastIndex = match.index + fullMatch.length;
      continue;
    }

    const trailing = label ? "" : (fullMatch.match(/[),.;:!?]+$/)?.[0] ?? "");
    const cleanHref = trailing && href.endsWith(trailing)
      ? href.slice(0, -trailing.length)
      : href;
    const normalizedHref = normalizeDocumentationHref(cleanHref);

    if (normalizedHref) {
      const isExternal = /^https?:\/\//i.test(normalizedHref);
      const isDocumentationLink = isDocumentationHref(normalizedHref);
      nodes.push(
        <DocumentationAnchor
          key={`${match.index}-${normalizedHref}`}
          href={normalizedHref}
          target={isExternal && !isDocumentationLink ? "_blank" : undefined}
          rel={
            isExternal && !isDocumentationLink ? "noreferrer" : undefined
          }
          className="font-medium underline decoration-current/40 underline-offset-4 transition-colors hover:decoration-current"
        >
          {label ? <MarkdownInlineText text={label} /> : cleanHref}
        </DocumentationAnchor>,
      );
      if (trailing) nodes.push(trailing);
    } else {
      nodes.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes}</>;
}

function parseTextBlocks(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: TextBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: "code",
        text: codeLines.join("\n"),
        language: fenceMatch[1],
      });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (
      isTableRow(trimmed) &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1].trim())
    ) {
      const headers = parseTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index].trim())) {
        rows.push(parseTableRow(lines[index].trim()));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current ||
        current.startsWith("```") ||
        /^(#{1,4})\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current) ||
        (isTableRow(current) &&
          index + 1 < lines.length &&
          isTableSeparator(lines[index + 1].trim()))
      ) {
        break;
      }
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push({
      type: "paragraph",
      text: paragraphLines.join("\n").trim(),
    });
  }

  return blocks;
}

function isTableRow(value: string) {
  return value.startsWith("|") && value.endsWith("|");
}

function isTableSeparator(value: string) {
  if (!isTableRow(value)) return false;
  const cells = parseTableRow(value);
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

function parseTableRow(value: string) {
  return value
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeDocumentationHref(rawHref: string) {
  const href = rawHref.trim();
  if (!href) return null;

  if (href.startsWith("/")) {
    return stripMarkdownRoute(href);
  }

  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      url.pathname = stripMarkdownRoute(url.pathname);
      return url.toString();
    } catch {
      return null;
    }
  }

  if (href.startsWith("#")) return href;

  return null;
}

function DocumentationAnchor({
  href,
  onClick,
  ...props
}: ComponentProps<"a">) {
  const router = useRouter({ warn: false });

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !href ||
      !isDocumentationHref(href)
    ) {
      return;
    }

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;

    event.preventDefault();
    const referenceMatch = url.pathname.match(/^\/reference\/([^/]+)\/?$/);
    if (referenceMatch) {
      void router?.navigate({
        to: "/reference/$endpointSlug",
        params: { endpointSlug: decodeURIComponent(referenceMatch[1]) },
        hash: url.hash.slice(1),
        viewTransition: true,
      });
      return;
    }

    const guideMatch = url.pathname.match(/^\/docs\/([^/]+)\/?$/);
    if (guideMatch) {
      void router?.navigate({
        to: "/docs/$guideSlug",
        params: { guideSlug: decodeURIComponent(guideMatch[1]) },
        hash: url.hash.slice(1),
        viewTransition: true,
      });
      return;
    }

    const legacyGuideMatch = url.pathname.match(/^\/guides\/([^/]+)\/?$/);
    if (legacyGuideMatch) {
      void router?.navigate({
        to: "/guides/$guideSlug",
        params: { guideSlug: decodeURIComponent(legacyGuideMatch[1]) },
        hash: url.hash.slice(1),
        viewTransition: true,
      });
    }
  }

  return <a href={href} onClick={handleClick} {...props} />;
}

function isDocumentationHref(value: string) {
  try {
    const pathname = /^https?:\/\//i.test(value)
      ? new URL(value).pathname
      : value.split(/[?#]/, 1)[0];
    return (
      pathname === "/docs" ||
      pathname.startsWith("/docs/") ||
      pathname === "/guides" ||
      pathname.startsWith("/guides/") ||
      pathname === "/reference" ||
      pathname.startsWith("/reference/")
    );
  } catch {
    return false;
  }
}

function stripMarkdownRoute(value: string) {
  const [pathAndQuery, hash = ""] = value.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const nextPath = path.endsWith(".md") ? path.slice(0, -3) : path;
  return `${nextPath}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}
