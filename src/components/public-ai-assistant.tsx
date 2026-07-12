import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Check,
  Circle,
  Bot,
  Copy,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Square,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { cn } from "../lib/utils";
import {
  AiMessageContent,
  AiMessageReferences,
  getMessageText,
} from "./ai-message-content";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const PROGRESS_STEPS = [
  "Searching documentation",
  "Reading relevant documentation",
  "Preparing an answer",
  "Writing the response",
];

const publicAiScrollMemory = new Map<string, number>();

type PublicChatMessage = UIMessage<
  unknown,
  {
    progress: {
      step: number;
      label: string;
    };
  }
>;

function getMessagesStorageKey(organizationSlug: string, projectSlug: string) {
  return `adisa-public-ai-messages:${organizationSlug}:${projectSlug}`;
}

function readStoredMessages(
  organizationSlug: string,
  projectSlug: string,
): PublicChatMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.sessionStorage.getItem(
      getMessagesStorageKey(organizationSlug, projectSlug),
    );
    return stored ? (JSON.parse(stored) as PublicChatMessage[]) : [];
  } catch {
    window.sessionStorage.removeItem(
      getMessagesStorageKey(organizationSlug, projectSlug),
    );
    return [];
  }
}

function getOrCreateSessionId(organizationSlug: string, projectSlug: string) {
  if (typeof window === "undefined") return "pending";

  const storageKey = `adisa-public-ai-session:${organizationSlug}:${projectSlug}`;
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;

    const next =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getConversationSignature(messages: PublicChatMessage[]) {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return "empty";

  return [
    messages.length,
    lastMessage.id,
    lastMessage.parts.length,
    getMessageText(lastMessage).length,
  ].join(":");
}

export function PublicAiAssistant({
  open,
  organizationSlug,
  projectSlug,
  currentPageTitle,
  currentPagePath,
  displayName,
  onOpenChange,
}: {
  open: boolean;
  organizationSlug: string;
  projectSlug: string;
  currentPageTitle: string;
  currentPagePath: string;
  displayName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("pending");
  const [progressStep, setProgressStep] = useState(-1);
  const [progressLabel, setProgressLabel] = useState("");
  const initialMessages = useMemo(
    () => readStoredMessages(organizationSlug, projectSlug),
    [organizationSlug, projectSlug],
  );
  const [messagesHydrated] = useState(true);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const progressStepRef = useRef(-1);
  const hasRestoredConversationScrollRef = useRef(false);
  const conversationSignatureRef = useRef(
    getConversationSignature(initialMessages),
  );
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const pageContextRef = useRef({ currentPageTitle, currentPagePath });
  pageContextRef.current = { currentPageTitle, currentPagePath };

  useEffect(() => {
    setSessionId(getOrCreateSessionId(organizationSlug, projectSlug));
  }, [organizationSlug, projectSlug]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/public-chat",
        body: {
          organizationSlug,
          projectSlug,
        },
        prepareSendMessagesRequest: ({
          id,
          messages,
          trigger,
          messageId,
          body,
        }) => ({
          body: {
            ...body,
            organizationSlug,
            projectSlug,
            sessionId: sessionIdRef.current,
            ...pageContextRef.current,
            id,
            messages,
            trigger,
            messageId,
          },
        }),
      }),
    [
      organizationSlug,
      projectSlug,
    ],
  );
  const { messages, sendMessage, status, stop, error } =
    useChat<PublicChatMessage>({
    id: `public-ai-${organizationSlug}-${projectSlug}`,
    transport,
    messages: initialMessages,
    onData: (part) => {
      if (part.type === "data-progress") {
        if (part.data.step < progressStepRef.current) return;
        progressStepRef.current = part.data.step;
        setProgressStep(part.data.step);
        setProgressLabel(part.data.label);
      }
    },
    onFinish: () => {
      progressStepRef.current = -1;
      setProgressStep(-1);
      setProgressLabel("");
    },
    onError: () => {
      progressStepRef.current = -1;
      setProgressStep(-1);
      setProgressLabel("");
    },
  });
  const isBusy = status === "submitted" || status === "streaming";
  const canSend = input.trim().length > 0 && !isBusy && sessionId !== "pending";

  useEffect(() => {
    if (!messagesHydrated) return;
    window.sessionStorage.setItem(
      getMessagesStorageKey(organizationSlug, projectSlug),
      JSON.stringify(messages),
    );
  }, [messages, messagesHydrated, organizationSlug, projectSlug]);

  useEffect(() => {
    if (!open) return;
    const signature = getConversationSignature(messages);

    if (!hasRestoredConversationScrollRef.current) {
      hasRestoredConversationScrollRef.current = true;
      conversationSignatureRef.current = signature;
      const key = `${organizationSlug}:${projectSlug}`;
      const scrollTop = publicAiScrollMemory.get(key);
      if (scrollTop !== undefined && conversationScrollRef.current) {
        const frame = window.requestAnimationFrame(() => {
          if (conversationScrollRef.current) {
            conversationScrollRef.current.scrollTo({
              top: scrollTop,
              behavior: "auto",
            });
          }
        });
        return () => window.cancelAnimationFrame(frame);
      }
      return;
    }

    if (conversationSignatureRef.current === signature) return;
    conversationSignatureRef.current = signature;
    if (messages.length === 0) return;
    const container = conversationScrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: status === "streaming" ? "auto" : "smooth",
    });
  }, [messages, open, status, organizationSlug, projectSlug]);

  useEffect(() => {
    const key = `${organizationSlug}:${projectSlug}`;
    return () => {
      if (conversationScrollRef.current) {
        publicAiScrollMemory.set(key, conversationScrollRef.current.scrollTop);
      }
    };
  }, [organizationSlug, projectSlug]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy || sessionId === "pending") return;
    progressStepRef.current = 0;
    setProgressStep(0);
    setProgressLabel(PROGRESS_STEPS[0]);
    setInput("");
    await sendMessage({ text });
  }

  if (!open) {
    return null;
  }

  return (
    <aside className="fixed bottom-0 right-0 top-[var(--public-doc-header-height)] z-50 flex h-[calc(100svh-var(--public-doc-header-height))] w-[min(34rem,100vw)] flex-col overflow-hidden border-l bg-background shadow-2xl lg:sticky lg:top-[var(--public-doc-header-height)] lg:z-20 lg:w-[30rem] lg:shrink-0 lg:self-start lg:shadow-none xl:w-[34rem] 2xl:w-[38rem]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
        <Sparkles className="size-4 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {displayName || "AI Assistant"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
          aria-label="Close AI assistant"
        >
          <X />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={conversationScrollRef}
          onScroll={(event) => {
            publicAiScrollMemory.set(
              `${organizationSlug}:${projectSlug}`,
              event.currentTarget.scrollTop,
            );
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center text-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                <Sparkles className="size-9 text-muted-foreground" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">Good morning</h3>
              <p className="mt-1 max-w-64 text-sm text-muted-foreground">
                I&apos;m here to help you with the docs.
              </p>
            </div>
          ) : (
            <div
              className="space-y-6"
              role="log"
              aria-live="polite"
              aria-label="AI conversation"
            >
              {messages.map((message) => (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  assistantName={displayName || "AI Assistant"}
                />
              ))}
              {isBusy ? (
                <div className="flex items-start gap-3" aria-label="AI is responding">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm">
                    <Sparkles className="size-4" />
                  </div>
                  <AssistantProgress
                    currentStep={Math.max(progressStep, 0)}
                    currentLabel={progressLabel}
                    status={status}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-background p-4 sm:p-5">
          {error ? (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={submitMessage}
            className="rounded-xl border bg-background p-2 shadow-[0_0_0_3px_var(--muted)] focus-within:border-ring"
          >
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <Badge variant="outline" className="min-w-0 gap-1.5">
                <FileText data-icon="inline-start" />
                <span className="min-w-0 truncate">{currentPageTitle}</span>
              </Badge>
            </div>
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask, search, or explain…"
              className="min-h-20 resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:border-transparent focus-visible:shadow-none"
              disabled={isBusy || sessionId === "pending"}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Bot className="size-3.5" />
                Based on your context
              </p>
              {isBusy ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={stop}
                >
                  <Square data-icon="inline-start" />
                  Stop
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={!canSend}>
                  <Send data-icon="inline-start" />
                  Send
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </aside>
  );
}

function AssistantProgress({
  currentStep,
  currentLabel,
  status,
}: {
  currentStep: number;
  currentLabel: string;
  status: "submitted" | "streaming" | "ready" | "error";
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border bg-card px-3.5 py-3 shadow-[var(--surface-raised-shadow)]">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        {currentLabel ||
          (status === "submitted" ? "Starting…" : "Working on your answer")}
      </div>
      <ol className="space-y-1.5">
        {PROGRESS_STEPS.map((label, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                isComplete || isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground/60",
              )}
            >
              {isComplete ? (
                <Check className="size-3.5 text-primary" />
              ) : isCurrent ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <Circle className="size-3.5" />
              )}
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AssistantMessage({
  message,
  assistantName,
}: {
  message: UIMessage;
  assistantName: string;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const text = getMessageText(message);

  async function copyMessage() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (isUser) {
    return (
      <article className="flex justify-end gap-2.5">
        <div className="max-w-[88%] rounded-[1.15rem] rounded-br-md bg-primary px-4 py-2.5 text-sm leading-6 text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <UserRound className="size-4" />
        </div>
      </article>
    );
  }

  return (
    <article className="group/message flex min-w-0 gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex min-h-7 items-center gap-2">
          <p className="truncate text-xs font-semibold text-foreground">
            {assistantName}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/message:opacity-100"
            onClick={() => void copyMessage()}
            aria-label={copied ? "Response copied" : "Copy response"}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <div className="min-w-0 rounded-2xl rounded-tl-md border bg-card px-4 py-3.5 text-sm leading-6 text-card-foreground shadow-[var(--surface-raised-shadow)]">
          <AiMessageReferences message={message} />
          <AiMessageContent
            message={message}
            className="break-words [&_a]:text-primary"
          />
        </div>
      </div>
    </article>
  );
}
