import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Home, LogIn, RefreshCw } from "lucide-react";
import { getErrorMessage } from "../lib/errors";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const message = getErrorMessage(
    error,
    "The page could not be loaded. Retry or return to a safe route.",
  );

  return (
    <main className="surface-grid flex min-h-screen items-center justify-center px-5 py-10">
      <Card className="w-full max-w-lg p-7 sm:p-9">
        <Brand />
        <span className="mt-10 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          This page could not be loaded
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => {
              reset();
              window.location.reload();
            }}
          >
            <RefreshCw className="size-4" />
            Retry
          </Button>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted"
          >
            <Home className="size-4" />
            Home
          </Link>
          <Link
            to="/auth/sign-in"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogIn className="size-4" />
            Sign In
          </Link>
        </div>
      </Card>
    </main>
  );
}
