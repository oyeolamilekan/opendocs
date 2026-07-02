import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Lock, Play } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CodeSnippet, type CodeSnippetLanguage } from "./ui/code-snippet";
import { Input } from "./ui/input";

type PublicEndpoint = Awaited<
  ReturnType<typeof import("../lib/public-docs").loadPublicEndpoint>
>["endpoint"];

type ExecutionResult = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  contentType: string;
};

function formatResponseBody(body: unknown): string {
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2);
}

function resolveResponseLanguage(
  body: unknown,
  contentType: string,
): CodeSnippetLanguage {
  if (contentType.includes("json") || typeof body !== "string") {
    return "json";
  }
  return "text";
}

export function EndpointTester({
  organizationSlug,
  projectSlug,
  endpoint,
  parameters,
  body,
  credential,
  onCredentialChange,
  variant = "card",
  compact = false,
}: {
  organizationSlug: string;
  projectSlug: string;
  endpoint: PublicEndpoint;
  parameters: Record<string, string>;
  body: Record<string, unknown>;
  credential: string;
  onCredentialChange: (value: string) => void;
  variant?: "card" | "panel";
  compact?: boolean;
}) {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    onCredentialChange("");
    setResult(null);
    setError("");
  }, [endpoint.slug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          projectSlug,
          endpointSlug: endpoint.slug,
          parameters,
          body,
          credential,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Request failed");
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  const tester = (
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-5"}>
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Credentials
          </p>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="size-3" />
            Memory only
          </span>
        </div>
        {endpoint.body.authHeader.type !== "none" ? (
          <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background sm:flex-row">
            <span className="flex min-h-9 shrink-0 items-center border-b bg-muted/50 px-3 py-2 text-xs font-medium sm:h-9 sm:border-r sm:border-b-0 sm:py-0">
              {endpoint.body.authHeader.key ||
                (endpoint.body.authHeader.type === "apiKey"
                  ? "X-API-Key"
                  : "Authorization")}
            </span>
            <Input
              id="endpoint-credential"
              type="password"
              autoComplete="off"
              value={credential}
              onChange={(event) => onCredentialChange(event.target.value)}
              placeholder="Enter credential"
              className="h-9 min-w-0 rounded-none border-0 focus-visible:ring-0"
              aria-label="Request credential"
            />
          </div>
        ) : (
          <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
            No credentials required.
          </div>
        )}
      </section>

      <form
        id="endpoint-request-form"
        onSubmit={submit}
        className="flex justify-end"
      >
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={sending}
        >
          <Play data-icon="inline-start" />
          {sending ? "Sending..." : "Send Request"}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <section className="flex min-h-[20rem] flex-col overflow-hidden rounded-lg border bg-background sm:min-h-[24rem]">
          <div className="border-b bg-muted/50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Response
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={result.status >= 400 ? "destructive" : "default"}>
                {result.status}
              </Badge>
              <span className="text-xs font-medium">{result.statusText}</span>
            </div>
            <div className="code-sample response-code-sample overflow-hidden rounded-md">
              <div className="max-h-[34rem] min-h-64 overflow-auto">
                <CodeSnippet
                  code={formatResponseBody(result.body)}
                  language={resolveResponseLanguage(
                    result.body,
                    result.contentType,
                  )}
                  wrap
                />
              </div>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">
                Response Headers
              </summary>
              <div className="code-sample response-code-sample mt-2 overflow-hidden rounded-md">
                <CodeSnippet
                  code={JSON.stringify(result.headers, null, 2)}
                  language="json"
                  wrap
                />
              </div>
            </details>
          </div>
        </section>
      ) : null}
    </div>
  );

  if (variant === "panel") {
    return (
      <section className="max-h-[80svh] overflow-y-auto pr-1 xl:h-[42rem] xl:max-h-none">
        {tester}
      </section>
    );
  }

  return <section className="mt-12 rounded-xl border p-5">{tester}</section>;
}
