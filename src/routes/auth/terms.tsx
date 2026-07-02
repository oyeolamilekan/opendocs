import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Brand } from "../../components/brand";
import { Card } from "../../components/ui/card";
import { ThemeToggle } from "../../components/theme-toggle";

export const Route = createFileRoute("/auth/terms")({
  component: Terms,
});

function Terms() {
  return (
    <main className="min-h-screen px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <Card className="mt-8 p-7 sm:p-10">
          <Link
            to="/auth/sign-up"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to signup
          </Link>
          <h1 className="mt-8 text-3xl font-bold tracking-tight">
            Terms of service
          </h1>
          <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
            <p>
              These terms are an initial product placeholder and must be
              reviewed before production launch.
            </p>
            <p>
              You are responsible for the documentation and API credentials
              entered into your workspace. Do not store secrets in published
              documentation.
            </p>
            <p>
              Service availability, data retention, acceptable use, privacy,
              and support obligations will be finalized in the production
              terms.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
