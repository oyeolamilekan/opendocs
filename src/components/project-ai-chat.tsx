import { useMemo, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Bot,
  CornerDownLeft,
  Loader2,
  RefreshCw,
  Send,
  Square,
  UserRound,
} from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { cn } from "../lib/utils";
import {
  AiMessageContent,
  AiMessageReferences,
  getMessageText,
} from "./ai-message-content";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Textarea } from "./ui/textarea";

const SUGGESTIONS = [
  "Summarize this project's API surface.",
  "Which endpoints need better request or response examples?",
  "Draft onboarding notes for a developer using these docs.",
];

export function ProjectAiChat({
  project,
  organizationSlug,
  projectSlug,
}: {
  project: Doc<"apiProjects">;
  organizationSlug: string;
  projectSlug: string;
}) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        body: {
          projectId: project._id,
          organizationSlug,
          projectSlug,
        },
      }),
    [organizationSlug, project._id, projectSlug],
  );
  const { messages, sendMessage, regenerate, stop, status, error } = useChat({
    id: `project-ai-${project._id}`,
    transport,
  });
  const isBusy = status === "submitted" || status === "streaming";
  const canSubmit = input.trim().length > 0 && !isBusy;

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    await sendMessage({ text });
  }

  async function sendSuggestion(text: string) {
    if (isBusy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 lg:px-8">
        <Card className="border-border/70 bg-card/80 shadow-none">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Bot data-icon="inline-start" />
                Vercel AI Gateway
              </Badge>
              <Badge variant="outline">{project.visibility}</Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">
              Ask questions about {project.title}
            </CardTitle>
            <CardDescription>
              Answers are grounded in this project’s guides and API reference.
              Stored auth header values are excluded from AI context.
            </CardDescription>
          </CardHeader>
        </Card>

        <section
          className="min-h-[420px] flex-1 rounded-xl border bg-background"
          aria-label="AI conversation"
        >
          {messages.length === 0 ? (
            <EmptyConversation onSend={sendSuggestion} disabled={isBusy} />
          ) : (
            <div className="flex flex-col gap-4 p-4 md:p-5">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isBusy ? (
                <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </div>
              ) : null}
            </div>
          )}
        </section>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>AI request failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}

        <form
          onSubmit={submitMessage}
          className="rounded-xl border bg-card p-2 shadow-[var(--surface-raised-shadow)]"
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask about your guides, endpoints, schemas, auth, examples…"
            className="max-h-48 min-h-24 resize-none border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:shadow-none"
            disabled={isBusy}
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <CornerDownLeft className="size-3.5" />
              Enter to send · Shift Enter for a new line
            </p>
            <div className="ml-auto flex items-center gap-2">
              {messages.length > 0 && !isBusy ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void regenerate()}
                >
                  <RefreshCw data-icon="inline-start" />
                  Regenerate
                </Button>
              ) : null}
              {isBusy ? (
                <Button type="button" variant="secondary" onClick={stop}>
                  <Square data-icon="inline-start" />
                  Stop
                </Button>
              ) : (
                <Button type="submit" disabled={!canSubmit}>
                  <Send data-icon="inline-start" />
                  Send
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyConversation({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void | Promise<void>;
  disabled: boolean;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
        <Bot className="size-6" />
      </div>
      <div className="max-w-md">
        <h2 className="text-xl font-semibold tracking-tight">
          Start with a project question
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The assistant can explain endpoints, compare docs, find gaps, and
          draft developer-facing documentation from your current project data.
        </p>
      </div>
      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-3">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            className="h-auto whitespace-normal py-3 text-left text-sm"
            disabled={disabled}
            onClick={() => void onSend(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const Icon = isUser ? UserRound : Bot;

  return (
    <article
      className={cn(
        "flex gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser ? (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[min(760px,85%)] rounded-2xl px-4 py-3 text-sm leading-6",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{getMessageText(message)}</p>
        ) : (
          <>
            <AiMessageReferences message={message} />
            <AiMessageContent message={message} />
          </>
        )}
      </div>
      {isUser ? (
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border bg-primary text-primary-foreground">
          <Icon className="size-4" />
        </div>
      ) : null}
    </article>
  );
}
