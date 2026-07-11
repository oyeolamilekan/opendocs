import { cn } from "../../lib/utils";
import type { RichContentHeading } from "../../lib/rich-content";

export function DocumentationTableOfContents({
  headings,
  className,
}: {
  headings: RichContentHeading[];
  className?: string;
}) {
  if (headings.length === 0) return null;

  return (
    <nav
      aria-label="Table of contents"
      className={cn(
        "public-documentation-toc rounded-lg border bg-card/70 p-4 text-sm",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        On this page
      </p>
      <ol className="mt-3 flex flex-col gap-0.5">
        {headings.map((heading) => (
          <li key={heading.id} className="min-w-0">
            <a
              href={`#${heading.id}`}
              className={cn(
                "public-documentation-toc-link block min-w-0 rounded-sm py-1.5 pr-2 text-sm leading-5 transition-colors",
                heading.level === 1 && "pl-0 font-medium",
                heading.level === 2 && "pl-3",
                heading.level === 3 && "pl-6 text-xs",
              )}
            >
              <span className="line-clamp-2">{heading.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
