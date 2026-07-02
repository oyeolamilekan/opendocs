import { Link } from "@tanstack/react-router";
import { PanelsTopLeft } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 text-foreground">
      <span className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
        <PanelsTopLeft className="size-4.5" />
      </span>
      {!compact ? (
        <span className="text-[1.05rem] font-bold tracking-tight">Minialdoc</span>
      ) : null}
    </Link>
  );
}
