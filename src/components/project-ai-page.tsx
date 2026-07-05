import { Link } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import {
  Bot,
  ChevronRight,
  Clock3,
  KeyRound,
  MessageSquareText,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  AI_MODEL_PRESETS,
  AI_PROVIDER_MODES,
  AI_PROVIDERS,
  type AiProvider,
  type AiProviderMode,
} from "../lib/ai-provider-options";
import { cn } from "../lib/utils";
import { AiMessageContent } from "./ai-message-content";
import { smoothDashboardLinkProps } from "./dashboard-navigation";
import { ProjectDashboardLoadingPage } from "./project-dashboard-loading-page";
import { ProjectParentNavigation } from "./project-editor";
import { ThemeToggle } from "./theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Field, FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./ui/sidebar";
import { EmptyState, LoadingState } from "./ui/status";
import { useToast } from "./ui/toast";

type AiSettings = NonNullable<
  NonNullable<
    ReturnType<typeof useQuery<typeof api.ai.getDashboardBySlug>>
  >["settings"]
>;
type AiConversation = Doc<"projectAiConversations">;
type AiConversationSummary = {
  _id: Id<"projectAiConversations">;
  _creationTime: number;
  projectId: Id<"apiProjects">;
  sessionId: string;
  title: string;
  providerMode: AiProviderMode;
  provider: AiProvider;
  model: string;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: number;
  updatedAt: number;
};
type AiSection = "configuration" | "conversation";
const CONVERSATION_PAGE_SIZE = 12;

const AI_SECTION_DETAILS: Record<
  AiSection,
  {
    title: string;
    description: string;
    icon: typeof SlidersHorizontal;
  }
> = {
  configuration: {
    title: "Configuration",
    description: "AI configuration models and provider settings.",
    icon: SlidersHorizontal,
  },
  conversation: {
    title: "Conversation",
    description: "List of conversations captured from public docs.",
    icon: MessageSquareText,
  },
};

function getAiSectionStorageKey(organizationSlug: string, projectSlug: string) {
  return `adisa-project-ai-section:${organizationSlug}:${projectSlug}`;
}

function readAiSection(organizationSlug: string, projectSlug: string) {
  try {
    const value = window.sessionStorage.getItem(
      getAiSectionStorageKey(organizationSlug, projectSlug),
    );
    return value === "configuration" || value === "conversation" ? value : null;
  } catch {
    return null;
  }
}

function persistAiSection(
  organizationSlug: string,
  projectSlug: string,
  section: AiSection,
) {
  try {
    window.sessionStorage.setItem(
      getAiSectionStorageKey(organizationSlug, projectSlug),
      section,
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function ProjectAiPage({
  organization,
  membership,
  projectSlug,
}: {
  organization: Doc<"organizations">;
  membership: Doc<"organizationMembers">;
  projectSlug: string;
}) {
  const dashboard = useQuery(api.ai.getDashboardBySlug, {
    organizationId: organization._id,
    slug: projectSlug,
  });
  const [activeSection, setActiveSection] =
    useState<AiSection>("configuration");
  const project = dashboard?.project;
  const settings = dashboard?.settings;
  const versions = dashboard?.versions ?? [];
  const displayVersion =
    versions.find((version) => version.isDefault)?.name ??
    versions[0]?.name ??
    "v1.0";
  const conversations = usePaginatedQuery(
    api.ai.listConversationSummaries,
    project && activeSection === "conversation"
      ? { projectId: project._id }
      : "skip",
    { initialNumItems: CONVERSATION_PAGE_SIZE },
  );
  const canManage = membership.role === "owner" || membership.role === "admin";

  useEffect(() => {
    const storedSection = readAiSection(organization.slug, projectSlug);
    if (storedSection) {
      setActiveSection(storedSection);
    }
  }, [organization.slug, projectSlug]);

  useEffect(() => {
    persistAiSection(organization.slug, projectSlug, activeSection);
  }, [activeSection, organization.slug, projectSlug]);

  if (dashboard === undefined) {
    return <ProjectDashboardLoadingPage kind="ai" label="Loading AI page" />;
  }

  if (dashboard === null || !project || !settings) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          title="Project Not Found"
          description="This project may have been renamed or deleted. Return to the project list to continue."
          action={
            <Button asChild>
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug: organization.slug }}
                {...smoothDashboardLinkProps}
              >
                Return to projects
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="project-editor-shell flex min-h-svh w-full overflow-x-hidden bg-sidebar text-foreground">
      <ProjectParentNavigation
        organizationSlug={organization.slug}
        projectSlug={project.slug}
        projectId={project._id}
        projectTitle={project.title}
        versions={versions ?? []}
        canManage={canManage}
        activeArea="ai"
      />
      <SidebarProvider
        className="min-w-0 flex-1 overflow-x-hidden"
        style={{ "--sidebar-width": "19rem" } as CSSProperties}
      >
        <Sidebar
          collapsible="offcanvas"
          className="project-documentation-sidebar lg:left-60!"
        >
          <SidebarHeader className="project-documentation-sidebar-header project-editor-sidebar-header border-b border-sidebar-border">
            <div className="project-editor-sidebar-titlebar">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Artificial intelligence
                </p>
                <p className="truncate text-sm font-semibold">
                  {project.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {displayVersion}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="project-documentation-sidebar-content">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {(
                    Object.entries(AI_SECTION_DETAILS) as [
                      AiSection,
                      (typeof AI_SECTION_DETAILS)[AiSection],
                    ][]
                  ).map(([section, details]) => {
                    const Icon = details.icon;
                    const active = activeSection === section;

                    return (
                      <SidebarMenuItem key={section}>
                        <SidebarMenuButton
                          type="button"
                          size="lg"
                          isActive={active}
                          onClick={() => setActiveSection(section)}
                          className="h-11 min-h-11 items-center py-2"
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {details.title}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 overflow-x-hidden">
          <header className="sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link
                      to="/app/$organizationSlug/projects"
                      params={{ organizationSlug: organization.slug }}
                      {...smoothDashboardLinkProps}
                    >
                      {organization.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:list-item">
                  <ChevronRight />
                </BreadcrumbSeparator>
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link
                      to="/app/$organizationSlug/projects/$projectSlug"
                      params={{
                        organizationSlug: organization.slug,
                        projectSlug: project.slug,
                      }}
                      {...smoothDashboardLinkProps}
                    >
                      {project.title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:list-item">
                  <ChevronRight />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {AI_SECTION_DETAILS[activeSection].title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ThemeToggle className="ml-auto" />
          </header>

          <main className="dashboard-route-panel min-w-0 flex-1 overflow-x-hidden bg-background">
            <section className="mx-auto w-full max-w-[96rem] px-4 py-6 lg:px-8">
              {activeSection === "configuration" ? (
                <AiSettingsForm
                  projectId={project._id}
                  settings={settings}
                  canManage={canManage}
                />
              ) : (
                <ConversationPanel
                  conversations={conversations.results}
                  conversationStatus={conversations.status}
                  onLoadMore={() =>
                    conversations.loadMore(CONVERSATION_PAGE_SIZE)
                  }
                />
              )}
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

function AiSettingsForm({
  projectId,
  settings,
  canManage,
}: {
  projectId: Id<"apiProjects">;
  settings: AiSettings;
  canManage: boolean;
}) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [providerMode, setProviderMode] = useState<AiProviderMode>(
    settings.providerMode,
  );
  const [provider, setProvider] = useState<AiProvider>(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [displayName, setDisplayName] = useState(settings.displayName);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const modelPresets = useMemo(
    () => AI_MODEL_PRESETS[provider] ?? [],
    [provider],
  );
  const selectedMode = AI_PROVIDER_MODES.find(
    (mode) => mode.value === providerMode,
  );
  const requiresProjectKey = providerMode !== "gateway";

  useEffect(() => {
    setEnabled(settings.enabled);
    setProviderMode(settings.providerMode);
    setProvider(settings.provider);
    setModel(settings.model);
    setDisplayName(settings.displayName);
    setApiKey("");
    setClearApiKey(false);
  }, [settings]);

  useEffect(() => {
    if (providerMode === "gateway") {
      setProvider("vercel");
    } else if (provider === "vercel") {
      setProvider("openai");
    }
  }, [provider, providerMode]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || isSaving) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/ai/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          enabled,
          providerMode,
          provider,
          model,
          displayName,
          apiKey,
          clearApiKey,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save AI settings");
      }

      setApiKey("");
      setClearApiKey(false);
      toast.success("AI settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save AI settings",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={saveSettings} className="min-w-0">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant="outline">{selectedMode?.label}</Badge>
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Public documentation AI
          </CardTitle>
          <CardDescription>
            Configure the assistant model and provider shown in the public
            documentation experience. Provider keys are encrypted before they
            are stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!canManage ? (
            <Alert>
              <ShieldCheck />
              <AlertTitle>Read-only access</AlertTitle>
              <AlertDescription>
                Only organization owners and admins can change AI settings.
              </AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup>
            <Field label="Public AI" htmlFor="ai-enabled">
              <Select
                value={enabled ? "enabled" : "disabled"}
                onValueChange={(value) => setEnabled(value === "enabled")}
                disabled={!canManage}
              >
                <SelectTrigger id="ai-enabled">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Provider mode" htmlFor="ai-provider-mode">
              <Select
                value={providerMode}
                onValueChange={(value) =>
                  setProviderMode(value as AiProviderMode)
                }
                disabled={!canManage}
              >
                <SelectTrigger id="ai-provider-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AI_PROVIDER_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedMode?.description}
              </p>
            </Field>

            <Field label="Provider" htmlFor="ai-provider">
              <Select
                value={provider}
                onValueChange={(value) => setProvider(value as AiProvider)}
                disabled={!canManage || providerMode === "gateway"}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AI_PROVIDERS.filter((option) =>
                      providerMode === "gateway"
                        ? option.value === "vercel"
                        : option.value !== "vercel",
                    ).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Model" htmlFor="ai-model">
              <div className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <Select
                  value={modelPresets.includes(model) ? model : "custom"}
                  onValueChange={(value) => {
                    if (value !== "custom") setModel(value);
                  }}
                  disabled={!canManage || modelPresets.length === 0}
                >
                  <SelectTrigger id="ai-model-preset">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {modelPresets.map((preset) => (
                        <SelectItem key={preset} value={preset}>
                          {preset}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom model</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  id="ai-model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="provider/model-name"
                  disabled={!canManage}
                />
              </div>
            </Field>

            <Field label="Public display name" htmlFor="ai-display-name">
              <Input
                id="ai-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="AI assistant"
                disabled={!canManage}
              />
            </Field>

            <Field label="Provider API key" htmlFor="ai-provider-api-key">
              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ai-provider-api-key"
                    type="password"
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value);
                      setClearApiKey(false);
                    }}
                    placeholder={
                      settings.apiKeyConfigured
                        ? `Stored key ${settings.apiKeyHint ?? ""}`
                        : requiresProjectKey
                          ? "Paste provider API key"
                          : "Optional for Gateway mode"
                    }
                    className="pl-9"
                    disabled={!canManage}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {settings.apiKeyConfigured
                      ? `A key is stored${settings.apiKeyHint ? ` (${settings.apiKeyHint})` : ""}. Leave this blank to keep it.`
                      : "No project-level provider key is stored."}
                  </p>
                  {settings.apiKeyConfigured ? (
                    <Button
                      type="button"
                      variant={clearApiKey ? "destructive" : "outline"}
                      size="sm"
                      disabled={!canManage}
                      onClick={() => {
                        setApiKey("");
                        setClearApiKey((current) => !current);
                      }}
                    >
                      {clearApiKey ? "Will remove key" : "Remove key"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Field>
          </FieldGroup>

          <div className="flex justify-end">
            <Button type="submit" disabled={!canManage || isSaving}>
              <Save data-icon="inline-start" />
              {isSaving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function ConversationPanel({
  conversations,
  conversationStatus,
  onLoadMore,
}: {
  conversations: AiConversationSummary[];
  conversationStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  onLoadMore: () => void;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    AiConversation["_id"] | null
  >(null);
  const selectedConversation =
    conversations.find(
      (conversation) => conversation._id === selectedConversationId,
    ) ??
    conversations[0] ??
    null;
  const isLoadingFirstPage =
    conversationStatus === "LoadingFirstPage" && conversations.length === 0;
  const isLoadingMore = conversationStatus === "LoadingMore";
  const canLoadMore = conversationStatus === "CanLoadMore";

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedConversationId(null);
      return;
    }

    if (
      selectedConversationId &&
      conversations.some(
        (conversation) => conversation._id === selectedConversationId,
      )
    ) {
      return;
    }

    setSelectedConversationId(conversations[0]._id);
  }, [conversations, selectedConversationId]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-muted-foreground" />
          <CardTitle>Public conversations</CardTitle>
        </div>
        <CardDescription>
          Review conversations captured from the public documentation assistant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              {conversations.length === 0
                ? "No conversations loaded"
                : `${formatConversationCount(conversations.length)} loaded`}
            </p>
            <p className="text-xs text-muted-foreground">
              Inspect transcripts, session metadata, and recent activity without
              opening every record inline.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={!canLoadMore || isLoadingMore}
          >
            {isLoadingMore
              ? "Loading more…"
              : canLoadMore
                ? `Load ${CONVERSATION_PAGE_SIZE} more`
                : "All conversations loaded"}
          </Button>
        </div>

        {isLoadingFirstPage ? (
          <LoadingState label="Loading conversations" />
        ) : conversations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Public docs AI conversations will appear here once the public
              assistant is connected.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="space-y-3">
              {conversations.map((conversation) => (
                <ConversationListItem
                  key={conversation._id}
                  conversation={conversation}
                  isSelected={selectedConversation?._id === conversation._id}
                  onSelect={() => setSelectedConversationId(conversation._id)}
                />
              ))}
            </div>
            <ConversationDetail conversation={selectedConversation} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConversationListItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: AiConversationSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-4 text-left transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "bg-card hover:border-primary/40 hover:bg-muted/40",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{conversation.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(conversation.updatedAt)}</span>
            <span>{formatConversationCount(conversation.messageCount)}</span>
          </p>
        </div>
        <Badge
          variant={isSelected ? "secondary" : "outline"}
          className="shrink-0"
        >
          {conversation.provider}
        </Badge>
      </div>
      {conversation.lastMessagePreview ? (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">
          {conversation.lastMessagePreview}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No messages were stored for this conversation.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{conversation.providerMode}</Badge>
        <Badge variant="outline" className="max-w-full truncate">
          {conversation.model}
        </Badge>
      </div>
    </button>
  );
}

function ConversationDetail({
  conversation,
}: {
  conversation: AiConversationSummary | null;
}) {
  const fullConversation = useQuery(
    api.ai.getConversation,
    conversation ? { conversationId: conversation._id } : "skip",
  );

  if (!conversation) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm font-medium">Select a conversation</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a conversation from the list to inspect the full transcript.
        </p>
      </div>
    );
  }

  if (fullConversation === undefined) {
    return <LoadingState label="Loading conversation" />;
  }

  if (fullConversation === null) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm font-medium">Conversation unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This conversation may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {conversation.title}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              <span>Updated {formatDateTime(fullConversation.updatedAt)}</span>
              <span>
                {formatConversationCount(fullConversation.messages.length)}
              </span>
            </p>
          </div>
          <Badge variant="outline">{fullConversation.provider}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{fullConversation.providerMode}</Badge>
          <Badge variant="outline">{fullConversation.model}</Badge>
          <Badge variant="outline">Session {fullConversation.sessionId}</Badge>
        </div>
      </div>

      <div className="grid gap-3 border-b px-5 py-4 text-sm sm:grid-cols-3">
        <MetadataItem
          label="Started"
          value={formatDateTime(fullConversation.createdAt)}
        />
        <MetadataItem
          label="Last activity"
          value={formatDateTime(fullConversation.updatedAt)}
        />
        <MetadataItem
          label="Transcript size"
          value={formatConversationCount(fullConversation.messages.length)}
        />
      </div>

      <div className="max-h-[42rem] space-y-3 overflow-auto px-5 py-4">
        {fullConversation.messages.map((message, index) => (
          <ConversationMessageCard
            key={`${message.createdAt}-${index}`}
            message={message}
          />
        ))}
      </div>
    </div>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function ConversationMessageCard({
  message,
}: {
  message: AiConversation["messages"][number];
}) {
  const isUser = message.role === "user";
  const RoleIcon = isUser ? UserRound : Bot;
  const formattedMessage = {
    id: `${message.role}-${message.createdAt}`,
    role: message.role,
    parts: [{ type: "text" as const, text: message.content }],
  };

  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        isUser ? "bg-muted/50" : "bg-background",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <RoleIcon className="size-4 text-muted-foreground" />
          <span>{isUser ? "User" : "Assistant"}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(message.createdAt)}
        </span>
      </div>
      <AiMessageContent
        message={formattedMessage}
        className={cn(
          "break-words text-sm leading-6",
          isUser ? "text-foreground" : "text-muted-foreground",
        )}
      />
    </article>
  );
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatConversationCount(count: number) {
  return `${count} ${count === 1 ? "message" : "messages"}`;
}
