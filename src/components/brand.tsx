import { Link } from "@tanstack/react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 text-foreground">
      <span className="flex size-9 items-center justify-center rounded-md border border-border bg-white p-1.5">
        <img
          src="/openapidoc-icon.svg"
          alt=""
          aria-hidden="true"
          className="size-full object-contain"
        />
      </span>
      {!compact ? (
        <span className="text-[1.05rem] font-bold tracking-tight">openapidoc</span>
      ) : null}
    </Link>
  );
}
