import { Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import { Brand } from "./brand";
import { Card } from "./ui/card";

export function RouteNotFound() {
  return (
    <main className="surface-grid flex min-h-screen items-center justify-center px-5 py-10">
      <Card className="w-full max-w-lg p-7 sm:p-9">
        <Brand />
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page may have moved, been deleted, or the address may be
          incorrect.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/80"
          >
            <Home className="size-4" />
            Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Go back
          </button>
        </div>
      </Card>
    </main>
  );
}
