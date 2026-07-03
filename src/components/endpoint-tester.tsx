import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Expand,
  Lock,
  Play,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { CodeSnippet, type CodeSnippetLanguage } from "./ui/code-snippet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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

type HeaderRow = {
  name: string;
  value: string;
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

function responseStatusTone(status: number) {
  if (status >= 500) return "bg-red-500";
  if (status >= 400) return "bg-red-500";
  if (status >= 300) return "bg-amber-500";
  return "bg-emerald-500";
}

function headerRows(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => ({ name, value }));
}

function requestHeaderRows(
  endpoint: PublicEndpoint,
  credential: string,
): HeaderRow[] {
  const rows: HeaderRow[] = [{ name: "accept", value: "application/json" }];
  const authType = endpoint.body.authHeader.type;
  const authKey =
    endpoint.body.authHeader.key ||
    (authType === "apiKey" ? "X-API-Key" : "Authorization");
  const trimmedCredential = credential.trim();

  if (authType !== "none" && trimmedCredential) {
    rows.push({
      name: authKey,
      value:
        authType === "bearer"
          ? `Bearer ${trimmedCredential}`
          : authType === "basic"
            ? `Basic ${trimmedCredential}`
            : trimmedCredential,
    });
  }

  return rows;
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
  const [headersOpen, setHeadersOpen] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

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
    setHeadersOpen(false);
    setCopiedResponse(false);
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

  async function copyResponse() {
    if (!result) return;

    await navigator.clipboard.writeText(formatResponseBody(result.body));
    setCopiedResponse(true);
    window.setTimeout(() => setCopiedResponse(false), 1500);
  }

  const responseCode = result ? formatResponseBody(result.body) : "";
  const responseLanguage = result
    ? resolveResponseLanguage(result.body, result.contentType)
    : "text";
  const responseHeaders = result ? headerRows(result.headers) : [];
  const requestHeaders = requestHeaderRows(endpoint, credential);

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
        <section className="code-sample response-code-sample endpoint-response-card overflow-hidden rounded-lg border">
          <div className="endpoint-response-toolbar flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2">
            <span className="endpoint-response-pill inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium sm:h-10">
              <span
                className={`size-3 rounded-full ${responseStatusTone(result.status)}`}
              />
              <span className="font-mono">{result.status}</span>
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="endpoint-response-action h-10"
                onClick={() => setHeadersOpen(true)}
              >
                Headers
                <Expand data-icon="inline-end" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="endpoint-response-copy"
                onClick={() => void copyResponse()}
                aria-label={copiedResponse ? "Response copied" : "Copy response"}
              >
                {copiedResponse ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
          <div className="endpoint-response-body overflow-hidden rounded-b-lg">
            <div
              data-testid="response-body-scroll"
              className="endpoint-response-scroll max-h-[clamp(10rem,29svh,19rem)] overflow-auto rounded-b-lg sm:max-h-[clamp(12rem,31svh,22rem)] lg:max-h-[clamp(14rem,34svh,26rem)]"
            >
              <CodeSnippet
                code={responseCode}
                language={responseLanguage}
                className="endpoint-response-snippet max-h-none"
              />
            </div>
          </div>
          <HeadersDialog
            open={headersOpen}
            onOpenChange={setHeadersOpen}
            responseHeaders={responseHeaders}
            requestHeaders={requestHeaders}
          />
        </section>
      ) : null}
    </div>
  );

  if (variant === "panel") {
    return <section className="min-w-0">{tester}</section>;
  }

  return <section className="mt-12 rounded-xl border p-5">{tester}</section>;
}

function HeadersDialog({
  open,
  onOpenChange,
  responseHeaders,
  requestHeaders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responseHeaders: HeaderRow[];
  requestHeaders: HeaderRow[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid max-h-[min(88svh,58rem)] w-[calc(100vw-2rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-5xl"
        showCloseButton
      >
        <DialogHeader className="border-b px-6 py-6 sm:px-8">
          <DialogTitle className="text-2xl font-semibold sm:text-3xl">
            Headers
          </DialogTitle>
          <DialogDescription className="sr-only">
            Request and response headers returned by the API tester.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8">
          <HeaderRowsPanel title="Response" rows={responseHeaders} />
          <HeaderRowsPanel
            title="Request"
            rows={requestHeaders}
            className="mt-6"
          />
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t bg-background px-6 py-4 sm:px-8 sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HeaderRowsPanel({
  title,
  rows,
  className,
}: {
  title: string;
  rows: HeaderRow[];
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border bg-background px-4 py-4">
        {rows.length ? (
          <dl className="grid gap-y-4 text-sm sm:grid-cols-[minmax(9rem,0.9fr)_minmax(0,1.1fr)] sm:gap-x-6">
            {rows.map((row) => (
              <div
                key={`${title}-${row.name}`}
                className="grid min-w-0 gap-1 sm:contents"
              >
                <dt className="min-w-0 break-words text-muted-foreground sm:text-right">
                  {row.name}
                </dt>
                <dd className="min-w-0 break-words font-mono text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No headers returned.</p>
        )}
      </div>
    </section>
  );
}
