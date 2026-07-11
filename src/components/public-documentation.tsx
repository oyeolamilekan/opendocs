import { Link, useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  BookOpenText,
  Check,
  ChevronRight,
  CodeXml,
  Copy,
  FileCode2,
  FileText,
  PanelsTopLeft,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { api } from "../../convex/_generated/api";
import {
  buildRequestUrl,
  generateCodeExamples,
  getPublicClient,
} from "../lib/public-docs";
import {
  coerceRequestValue,
  formatRequestInputValue,
  setNestedRequestValue,
} from "../lib/request-values";
import {
  DEFAULT_DOCUMENTATION_FONT,
  DEFAULT_DOCUMENTATION_STYLE,
  getDocumentationFontUrl,
  getDocumentationTheme,
} from "../lib/documentation-theme";
import { DocumentationIcon } from "../lib/documentation-icons";
import {
  formatEndpointMarkdown,
  formatGuideMarkdown,
} from "../lib/markdown-export";
import { cn } from "../lib/utils";
import {
  appendCodeExamplesMarkdown,
  markdownToPlainText,
} from "./public-documentation/markdown";
import {
  filterDocumentationSearchResults,
  getDocumentationSearchHaystack,
  getDocumentationSearchSnippet,
  getOptionalDescription,
  normalizeSearchText,
} from "./public-documentation/search";
import { shouldHandlePublicDocumentationClick } from "./public-documentation/navigation";
import type {
  DocumentationSearchResult,
  FieldItem,
  IndexedDocumentationSearchResult,
  PublicData,
} from "./public-documentation/types";
const PublicAiAssistant = lazy(() =>
  import("./public-ai-assistant").then(({ PublicAiAssistant: Component }) => ({
    default: Component,
  })),
);
const EndpointTester = lazy(() =>
  import("./endpoint-tester").then(({ EndpointTester: Component }) => ({
    default: Component,
  })),
);
import { RichContentRenderer } from "./rich-content-renderer";
import {
  extractRichContentHeadings,
} from "../lib/rich-content";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  copyTextToClipboard,
} from "./public-documentation/clipboard";
import { CodePanel, ResponseBodyCode } from "./public-documentation/endpoint-code";
import { DocumentationTableOfContents } from "./public-documentation/table-of-contents";
export { DocumentationTableOfContents, ResponseBodyCode };
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ThemeToggle } from "./theme-toggle";

type DocumentationSearchScope = "all" | "guides" | "reference";

const documentationSearchInputId = "docs-navigation-filter";
const publicAiOpenMemory = new Map<string, boolean>();
const trackedPageViewMemory = new Map<string, number>();

function getPublicAiOpenStorageKey(projectSlug: string) {
  return `adisa-public-ai-open:${projectSlug}`;
}

function readPublicAiOpen(projectSlug: string) {
  try {
    return (
      window.sessionStorage.getItem(getPublicAiOpenStorageKey(projectSlug)) ===
      "true"
    );
  } catch {
    return false;
  }
}

function persistPublicAiOpen(projectSlug: string, open: boolean) {
  try {
    window.sessionStorage.setItem(
      getPublicAiOpenStorageKey(projectSlug),
      String(open),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function PublicDocumentation({
  organizationSlug,
  projectSlug,
  data,
}: {
  organizationSlug: string;
  projectSlug: string;
  data: PublicData;
}) {
  const router = useRouter({ warn: false });
  const recordPageView = useMutation(api.analytics.recordPageView);
  const [language, setLanguage] = useState("cURL");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] =
    useState<DocumentationSearchScope>("all");
  const [copiedFormat, setCopiedFormat] = useState<
    "markdown" | "text" | "url" | null
  >(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [body, setBody] = useState<Record<string, unknown>>({});
  const [credential, setCredential] = useState("");
  const [isAiOpen, setIsAiOpenState] = useState(
    () => publicAiOpenMemory.get(projectSlug) ?? false,
  );
  const [isNavigationOpen, setIsNavigationOpen] = useState(
    () => !(publicAiOpenMemory.get(projectSlug) ?? false),
  );
  const isAiOpenRef = useRef(isAiOpen);
  const endpoint = "endpoint" in data ? data.endpoint : null;
  const guidePage = "guidePage" in data ? data.guidePage : null;
  const apiEndpoint = endpoint?.endpointType === "endpoint" ? endpoint : null;
  const isDocument = !apiEndpoint;
  const activeArea = guidePage ? "guides" : "api-reference";
  const currentSlug = guidePage?.slug ?? endpoint?.slug ?? "";
  const currentTitle = guidePage?.title ?? endpoint?.title ?? "";
  const currentContent = guidePage?.content ?? endpoint?.content;
  const currentHeadings = useMemo(
    () => (isDocument ? extractRichContentHeadings(currentContent) : []),
    [currentContent, isDocument],
  );
  const hasTableOfContents = currentHeadings.length >= 2;
  const currentDescription =
    guidePage?.description ?? endpoint?.body.description ?? "";
  const currentPagePath = guidePage
    ? `/docs/${guidePage.slug}`
    : endpoint
      ? `/reference/${endpoint.slug}`
      : "/";
  const currentPageType = guidePage ? "guide" : "reference";
  const isAiEnabled = Boolean(data.aiSettings?.enabled);
  const areaLabel = guidePage
    ? "Guides"
    : isDocument
      ? "Documentation"
      : "API Reference";
  const documentationTheme = getDocumentationTheme(
    data.project.project.themeColor,
  );
  const documentationPrimary =
    data.project.project.brandColor || documentationTheme.primary;
  const documentationStyle =
    data.project.project.documentationStyle ?? DEFAULT_DOCUMENTATION_STYLE;
  const documentationFont =
    data.project.project.documentationFont ?? DEFAULT_DOCUMENTATION_FONT;
  const publishedVersions =
    "versions" in data && Array.isArray(data.versions) ? data.versions : [];
  const currentVersion =
    publishedVersions.find(
      (version) => "versionSlug" in data && version.slug === data.versionSlug,
    ) ??
    publishedVersions.find((version) => version.isDefault) ??
    publishedVersions[0];

  useEffect(() => {
    if (!currentSlug) return;

    const trackingKey = [
      organizationSlug,
      projectSlug,
      currentVersion?.slug ?? "",
      currentPageType,
      currentSlug,
    ].join(":");
    const now = Date.now();
    const lastTrackedAt = trackedPageViewMemory.get(trackingKey);

    if (lastTrackedAt && now - lastTrackedAt < 10_000) return;

    trackedPageViewMemory.set(trackingKey, now);
    void recordPageView({
      organizationSlug,
      projectSlug,
      versionSlug: currentVersion?.slug,
      pageType: currentPageType,
      pageSlug: currentSlug,
      pageTitle: currentTitle || currentSlug,
    }).catch(() => {
      trackedPageViewMemory.delete(trackingKey);
    });
  }, [
    currentPageType,
    currentSlug,
    currentTitle,
    currentVersion?.slug,
    organizationSlug,
    projectSlug,
    recordPageView,
  ]);

  useEffect(() => {
    const restoredOpen = isAiEnabled && readPublicAiOpen(projectSlug);
    publicAiOpenMemory.set(projectSlug, restoredOpen);
    isAiOpenRef.current = restoredOpen;
    setIsAiOpenState(restoredOpen);
    setIsNavigationOpen(!restoredOpen);
  }, [isAiEnabled, projectSlug]);

  useEffect(() => {
    setParameters({});
    setBody({});
    setSearchQuery("");
    setSearchScope("all");
  }, [currentSlug]);

  useEffect(() => {
    const href = getDocumentationFontUrl(documentationFont);
    const linkId = "public-documentation-font";
    let link = document.getElementById(linkId) as HTMLLinkElement | null;

    if (!href) {
      link?.remove();
      return;
    }

    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;

    return () => {
      link?.remove();
    };
  }, [documentationFont]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        target?.getAttribute("role") === "textbox";
      const isCommandK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlash =
        event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;

      if (!isCommandK && (!isSlash || isEditableTarget)) return;

      event.preventDefault();
      setIsSearchOpen(true);
    }

    window.addEventListener("keydown", handleSearchShortcut);

    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, []);

  const updateAiOpen = useCallback(
    (value: boolean | ((current: boolean) => boolean)) => {
    const next =
      typeof value === "function" ? value(isAiOpenRef.current) : value;
    publicAiOpenMemory.set(projectSlug, next);
    isAiOpenRef.current = next;
    persistPublicAiOpen(projectSlug, next);
    setIsAiOpenState(next);
    setIsNavigationOpen(!next);
    },
    [projectSlug],
  );

  const url = useMemo(
    () =>
      apiEndpoint
        ? buildRequestUrl(
            data.project.project.baseUrl,
            apiEndpoint.body.path,
            apiEndpoint.body.parameters,
            parameters,
          )
        : "",
    [apiEndpoint, data.project.project.baseUrl, parameters],
  );
  const examples = useMemo<Record<string, string>>(() => {
    if (!apiEndpoint) return {};
    return generateCodeExamples({
      method: apiEndpoint.body.method,
      url,
      authType: apiEndpoint.body.authHeader.type,
      authKey: apiEndpoint.body.authHeader.key,
      hasBody: apiEndpoint.body.requestBody.length > 0,
      bodyValues: body,
      credential,
    });
  }, [body, apiEndpoint, url, credential]);
  const parameterGroups = useMemo(() => {
    const parameters = apiEndpoint?.body.parameters ?? [];
    return {
      path: parameters.filter((parameter) => parameter.location === "path"),
      query: parameters.filter((parameter) => parameter.location === "query"),
      other: parameters.filter(
        (parameter) =>
          parameter.location !== "path" && parameter.location !== "query",
      ),
    };
  }, [apiEndpoint]);
  const { path: pathParameters, query: queryParameters, other: otherParameters } =
    parameterGroups;
  const visibleGuideNavigation = useMemo(
    () =>
      [...data.guides]
        .sort((left, right) => left.position - right.position)
        .map((section) => ({
          ...section,
          pages: [...section.pages].sort(
            (left, right) => left.position - right.position,
          ),
        }))
        .filter((section) => section.pages.length > 0),
    [data.guides],
  );
  const visibleNavigation = useMemo(
    () =>
      [...data.navigation]
        .sort((left, right) => left.position - right.position)
        .map((section) => ({
          ...section,
          endpoints: [...section.endpoints].sort(
            (left, right) => left.position - right.position,
          ),
        }))
        .filter((section) => section.endpoints.length > 0),
    [data.navigation],
  );
  const searchIndex = useMemo<IndexedDocumentationSearchResult[]>(() => {
    const guideResults = visibleGuideNavigation.flatMap((section) =>
      section.pages.map((page) => {
        const result: DocumentationSearchResult = {
          id: `guide:${page._id}`,
          kind: "guide",
          title: page.title,
          description: getOptionalDescription(page),
          sectionTitle: section.title,
          href:
            currentVersion && !currentVersion.isDefault
              ? `/${currentVersion.slug}/docs/${page.slug}`
              : `/docs/${page.slug}`,
          iconName: page.iconName,
        };
        return {
          ...result,
          searchHaystack: getDocumentationSearchHaystack(result),
        };
      }),
    );
    const referenceResults = visibleNavigation.flatMap((section) =>
      section.endpoints.map((endpoint) => {
        const result: DocumentationSearchResult = {
          id: `reference:${endpoint._id}`,
          kind: "reference",
          title: endpoint.title,
          description: getOptionalDescription(endpoint),
          sectionTitle: section.title,
          href:
            currentVersion && !currentVersion.isDefault
              ? `/${currentVersion.slug}/reference/${endpoint.slug}`
              : `/reference/${endpoint.slug}`,
          iconName: endpoint.iconName,
          endpointType: endpoint.endpointType,
          method: endpoint.method,
          path: endpoint.path,
        };
        return {
          ...result,
          searchHaystack: getDocumentationSearchHaystack(result),
        };
      }),
    );

    return [...guideResults, ...referenceResults];
  }, [currentVersion, visibleGuideNavigation, visibleNavigation]);
  const searchResults = useMemo(() => {
    return filterDocumentationSearchResults(
      searchIndex,
      searchQuery,
      searchScope,
    );
  }, [
    searchQuery,
    searchScope,
    searchIndex,
  ]);
  const visibleCustomNavigation = useMemo(
    () =>
      [...(data.customNavigation ?? [])]
        .sort((left, right) => left.position - right.position)
        .filter((item) => item.isVisible),
    [data.customNavigation],
  );
  const firstGuidePage = useMemo(
    () => visibleGuideNavigation.flatMap((section) => section.pages).at(0),
    [visibleGuideNavigation],
  );
  const firstEndpoint = useMemo(
    () => visibleNavigation.flatMap((section) => section.endpoints).at(0),
    [visibleNavigation],
  );

  async function copyPageContent(format: "markdown" | "text" | "url") {
    const markdown = buildCurrentPageMarkdown();
    const value =
      format === "markdown"
        ? markdown
        : format === "text"
          ? markdownToPlainText(markdown)
          : window.location.href;

    await copyTextToClipboard(value);
    setCopiedFormat(format);
    window.setTimeout(() => setCopiedFormat(null), 1500);
  }

  function buildCurrentPageMarkdown() {
    if (guidePage) return formatGuideMarkdown({ guide: guidePage });
    if (!endpoint) return "";

    return appendCodeExamplesMarkdown(
      formatEndpointMarkdown({
        endpoint,
        baseUrl: data.project.project.baseUrl,
      }),
      endpoint.endpointType === "endpoint" ? examples : {},
    );
  }

  async function switchVersion(nextVersionSlug: string) {
    const nextVersion = publishedVersions.find(
      (version) => version.slug === nextVersionSlug,
    );
    if (!nextVersion) return;
    const prefix = nextVersion.isDefault ? "" : `/${nextVersion.slug}`;

    try {
      const client = getPublicClient();
      const args = {
        organizationSlug,
        projectSlug,
        versionSlug: nextVersion.slug,
      };
      const [navigation, guides] = await Promise.all([
        client.query(api.sections.publicNavigation, args),
        client.query(api.guides.publicNavigation, args),
      ]);

      const firstGuide = [...guides]
        .sort((left, right) => left.position - right.position)
        .flatMap((section) =>
          [...section.pages].sort(
            (left, right) => left.position - right.position,
          ),
        )
        .at(0);
      const firstEndpoint = [...navigation]
        .sort((left, right) => left.position - right.position)
        .flatMap((section) =>
          [...section.endpoints].sort(
            (left, right) => left.position - right.position,
          ),
        )
        .at(0);

      const firstGuidePath = firstGuide
        ? `${prefix}/docs/${firstGuide.slug}`
        : null;
      const firstReferencePath = firstEndpoint
        ? `${prefix}/reference/${firstEndpoint.slug}`
        : null;

      const nextPath =
        (currentPageType === "guide"
          ? (firstGuidePath ?? firstReferencePath)
          : (firstReferencePath ?? firstGuidePath)) ?? `${prefix}/`;

      navigatePublicDocumentationPath(router, nextPath);
    } catch {
      navigatePublicDocumentationPath(router, `${prefix}${currentPagePath}`);
    }
  }

  function versionedPath(path: string) {
    return currentVersion && !currentVersion.isDefault
      ? `/${currentVersion.slug}${path}`
      : path;
  }

  function customNavigationHref(href: string) {
    const normalized = href.trim();
    if (
      normalized === "/docs" ||
      normalized.startsWith("/docs/") ||
      normalized === "/reference" ||
      normalized.startsWith("/reference/")
    ) {
      return versionedPath(normalized);
    }
    return normalized;
  }

  function isExternalNavigationHref(href: string) {
    return /^https?:\/\//i.test(href);
  }

  const handlePublicDocumentationClick = useCallback(
    (event: MouseEvent<HTMLElement>, href?: string | null) => {
      if (!href || !shouldHandlePublicDocumentationClick(event, href)) return;

      event.preventDefault();
      navigatePublicDocumentationPath(router, href);
    },
    [router],
  );

  const handleSearchResultClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!shouldHandlePublicDocumentationClick(event, href)) return;

      event.preventDefault();
      setIsSearchOpen(false);
      navigatePublicDocumentationPath(router, href);
    },
    [router],
  );

  const handleRichContentClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;

      handlePublicDocumentationClick(event, link.getAttribute("href"));
    },
    [handlePublicDocumentationClick],
  );

  return (
    <SidebarProvider
      open={isNavigationOpen}
      onOpenChange={setIsNavigationOpen}
      style={
        {
          "--sidebar-width": "19rem",
          "--public-doc-header-height": "8rem",
          "--documentation-primary": documentationPrimary,
          "--documentation-ring": documentationPrimary,
          "--documentation-focus-ring":
            "color-mix(in srgb, var(--documentation-primary) 18%, transparent)",
          "--documentation-primary-dark":
            data.project.project.brandColor || documentationTheme.darkPrimary,
          "--documentation-ring-dark":
            data.project.project.brandColor || documentationTheme.darkRing,
        } as CSSProperties
      }
      data-docs-style={documentationStyle}
      data-docs-font={documentationFont}
      className="documentation-theme min-h-svh bg-background text-foreground"
    >
      <PublicDocumentationSidebarSync isAiOpen={isAiOpen} />
      <PublicDocumentationSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        scope={searchScope}
        onScopeChange={setSearchScope}
        results={searchResults}
        primaryColor={documentationPrimary}
        onResultClick={handleSearchResultClick}
      />
      <Sidebar
        collapsible="offcanvas"
        className="public-documentation-sidebar border-r"
      >
        <SidebarHeader className="hidden" />

        <SidebarContent className="py-3">
          <div className="px-4 pb-5 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-between rounded-lg bg-background px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground shadow-none"
              onClick={() => setIsSearchOpen(true)}
            >
              Jump to
              <span className="rounded-md border bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                ⌘K
              </span>
            </Button>
          </div>
          {activeArea === "guides" ? (
            visibleGuideNavigation.length ? (
              <>
                {visibleGuideNavigation.map((section) => (
                  <SidebarGroup key={section._id} className="p-0 pb-6">
                    <SidebarGroupLabel className="mb-1 h-auto rounded-none px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                      {section.title}
                    </SidebarGroupLabel>
                    <SidebarGroupContent className="px-2">
                      <SidebarMenu className="gap-0.5">
                        {section.pages.map((page) => (
                          <SidebarMenuItem key={page._id}>
                            <SidebarMenuButton
                              asChild
                              size="sm"
                              isActive={guidePage?.slug === page.slug}
                              className="h-auto min-h-10 rounded-md p-0 text-sm"
                            >
                              <GuideDocumentationLink
                                title={page.title}
                                iconName={page.iconName}
                                isActive={guidePage?.slug === page.slug}
                                href={versionedPath(`/docs/${page.slug}`)}
                              />
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))}
              </>
            ) : (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                No guides have been published.
              </p>
            )
          ) : visibleNavigation.length ? (
            <>
              {visibleNavigation.map((section) => (
                <SidebarGroup key={section._id} className="p-0 pb-6">
                  <SidebarGroupLabel className="mb-1 h-auto rounded-none px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {section.title}
                  </SidebarGroupLabel>
                  <SidebarGroupContent className="px-2">
                    <SidebarMenu className="gap-0.5">
                      {section.endpoints.map((endpointItem) => (
                        <SidebarMenuItem key={endpointItem._id}>
                          <SidebarMenuButton
                            asChild
                            size="sm"
                            isActive={endpoint?.slug === endpointItem.slug}
                            className="h-auto min-h-10 rounded-md p-0 text-sm"
                          >
                            <DocumentationLink
                              title={endpointItem.title}
                              method={endpointItem.method}
                              endpointType={endpointItem.endpointType}
                              iconName={endpointItem.iconName}
                              isActive={endpoint?.slug === endpointItem.slug}
                              href={versionedPath(
                                `/reference/${endpointItem.slug}`,
                              )}
                            />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </>
          ) : (
            <p className="px-5 py-8 text-center text-xs text-muted-foreground">
              No API reference pages have been published.
            </p>
          )}
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="public-documentation-inset min-w-0">
        <div className="flex min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <header className="public-documentation-header fixed inset-x-0 top-0 z-30 shrink-0 bg-background/95 backdrop-blur">
              <div className="public-documentation-brandbar flex min-h-16 items-center gap-4 overflow-x-auto border-b px-4 py-2 lg:px-7">
                <Link
                  to="/"
                  className="flex min-w-0 shrink-0 items-center gap-3 text-sm font-semibold"
                >
                  {data.project.project.logoUrl ? (
                    <span className="flex size-9 items-center justify-center">
                      <img
                        src={data.project.project.logoUrl}
                        alt=""
                        className={cn(
                          "max-h-9 max-w-9 object-contain",
                          data.project.project.darkLogoUrl && "dark:hidden",
                        )}
                      />
                      {data.project.project.darkLogoUrl ? (
                        <img
                          src={data.project.project.darkLogoUrl}
                          alt=""
                          className="hidden max-h-9 max-w-9 object-contain dark:block"
                        />
                      ) : null}
                    </span>
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <PanelsTopLeft />
                    </span>
                  )}
                </Link>
                <a
                  href="/"
                  onClick={(event) =>
                    handlePublicDocumentationClick(event, "/")
                  }
                  className="public-documentation-home-link"
                >
                  Home
                </a>
                <nav
                  aria-label="Custom documentation navigation"
                  className="ml-auto flex min-w-max items-center gap-1"
                >
                  {visibleCustomNavigation.map((item) => {
                    const href = customNavigationHref(item.href);
                    const isExternal = isExternalNavigationHref(href);

                    return (
                      <a
                        key={item._id}
                        href={href}
                        className="public-documentation-custom-nav-link"
                        target={
                          isExternal && item.openInNewTab ? "_blank" : undefined
                        }
                        rel={
                          isExternal && item.openInNewTab
                            ? "noreferrer"
                            : undefined
                        }
                        onClick={(event) =>
                          handlePublicDocumentationClick(event, href)
                        }
                      >
                        {item.label}
                      </a>
                    );
                  })}
                </nav>
              </div>
              <div className="public-documentation-brand-accent h-px bg-[var(--documentation-primary)]" />
              <div className="public-documentation-topbar flex min-h-15 shrink-0 items-center gap-3 overflow-x-auto border-b px-4 py-2 lg:px-7">
                <SidebarTrigger />
                {currentVersion ? (
                  <Select
                    value={currentVersion.slug}
                    onValueChange={switchVersion}
                  >
                    <SelectTrigger className="h-9 w-auto min-w-24 gap-2 rounded-md border-0 bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted">
                      <span className="font-mono">{currentVersion.name}</span>
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      position="popper"
                      className="min-w-80 p-2"
                    >
                      <SelectGroup>
                        {publishedVersions.map((version) => (
                          <SelectItem
                            key={version._id}
                            value={version.slug}
                            textValue={version.name}
                            className="min-h-12 rounded-md py-2 pl-4 pr-10 text-base"
                          >
                            <span className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                              <span className="min-w-0 shrink truncate font-semibold">
                                {version.name}
                              </span>
                              <span className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
                                {version.isDefault ? (
                                  <Badge
                                    variant="secondary"
                                    className="h-6 rounded-full bg-primary px-2.5 text-xs text-primary-foreground!"
                                  >
                                    Default
                                  </Badge>
                                ) : null}
                                {version.isBeta ? (
                                  <Badge
                                    variant="outline"
                                    className="h-6 rounded-full bg-muted px-2.5 text-xs text-muted-foreground!"
                                  >
                                    Beta
                                  </Badge>
                                ) : null}
                                {version.isDeprecated ? (
                                  <Badge
                                    variant="outline"
                                    className="h-6 rounded-full bg-destructive/10 px-2.5 text-xs text-destructive!"
                                  >
                                    Deprecated
                                  </Badge>
                                ) : null}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="font-mono">
                    v1.0
                  </Badge>
                )}
                <nav
                  className="public-documentation-area-nav"
                  aria-label="Documentation areas"
                >
                  {firstGuidePage ? (
                    <a
                      href={versionedPath(`/docs/${firstGuidePage.slug}`)}
                      onClick={(event) =>
                        handlePublicDocumentationClick(
                          event,
                          versionedPath(`/docs/${firstGuidePage.slug}`),
                        )
                      }
                      className="public-documentation-area-link"
                      data-active={activeArea === "guides" ? "" : undefined}
                      aria-current={
                        activeArea === "guides" ? "page" : undefined
                      }
                    >
                      <BookOpenText />
                      Guides
                    </a>
                  ) : (
                    <span
                      className="public-documentation-area-link"
                      aria-disabled="true"
                    >
                      <BookOpenText />
                      Guides
                    </span>
                  )}
                  {firstEndpoint ? (
                    <a
                      href={versionedPath(`/reference/${firstEndpoint.slug}`)}
                      onClick={(event) =>
                        handlePublicDocumentationClick(
                          event,
                          versionedPath(`/reference/${firstEndpoint.slug}`),
                        )
                      }
                      className="public-documentation-area-link"
                      data-active={
                        activeArea === "api-reference" ? "" : undefined
                      }
                      aria-current={
                        activeArea === "api-reference" ? "page" : undefined
                      }
                    >
                      <CodeXml />
                      API Reference
                    </a>
                  ) : (
                    <span
                      className="public-documentation-area-link"
                      aria-disabled="true"
                    >
                      <CodeXml />
                      API Reference
                    </span>
                  )}
                </nav>
                <button
                  type="button"
                  aria-label="Search documentation"
                  aria-haspopup="dialog"
                  aria-expanded={isSearchOpen}
                  aria-controls="public-documentation-search-dialog"
                  className="ml-auto flex h-10 min-w-44 max-w-64 shrink-0 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground shadow-none transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--documentation-focus-ring)]"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    Search
                  </span>
                  <span className="hidden text-[11px] font-medium sm:block">
                    ⌘K
                  </span>
                </button>
                <ThemeToggle className="shrink-0" />
                {isAiEnabled ? (
                  <Button
                    type="button"
                    variant={isAiOpen ? "secondary" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => updateAiOpen((current) => !current)}
                    aria-expanded={isAiOpen}
                    aria-controls="public-ai-assistant"
                  >
                    <Sparkles data-icon="inline-start" />
                    Ask AI
                  </Button>
                ) : null}
              </div>
            </header>

            <div
              className={cn(
                "public-documentation-body grid min-w-0 overflow-x-hidden",
                !isDocument &&
                  "xl:h-[calc(100svh-var(--public-doc-header-height))] xl:overflow-hidden",
                !isDocument &&
                  (isAiOpen
                    ? "xl:grid-cols-[minmax(20rem,0.85fr)_minmax(24rem,1.15fr)] 2xl:grid-cols-[minmax(24rem,0.9fr)_minmax(28rem,1.1fr)]"
                    : "xl:grid-cols-[minmax(0,1fr)_minmax(26rem,36rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(30rem,40rem)]"),
              )}
              data-ai-open={isAiOpen ? "" : undefined}
            >
              <main
                className={cn(
                  "public-documentation-main min-w-0 overflow-x-hidden px-4 py-7 sm:px-5 sm:py-9 lg:px-8 2xl:px-10",
                  !isDocument && "xl:overflow-y-auto xl:border-r",
                )}
              >
                <div
                  className={cn(
                    "mx-auto",
                    isDocument
                      ? hasTableOfContents
                        ? "max-w-7xl"
                        : "max-w-6xl"
                      : "max-w-4xl",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {areaLabel}
                      </p>
                      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                        {currentTitle}
                      </h1>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                        >
                          {copiedFormat ? (
                            <Check data-icon="inline-start" />
                          ) : (
                            <Copy data-icon="inline-start" />
                          )}
                          {copiedFormat ? "Copied" : "Copy"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onSelect={() => void copyPageContent("markdown")}
                          >
                            <FileCode2 data-icon="inline-start" />
                            Copy as Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void copyPageContent("text")}
                          >
                            <FileText data-icon="inline-start" />
                            Copy as text
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void copyPageContent("url")}
                          >
                            <Copy data-icon="inline-start" />
                            Copy page URL
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {!isDocument ? (
                    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                      <MethodBadge method={apiEndpoint.body.method} />
                      <code className="min-w-0 break-all text-sm text-muted-foreground sm:truncate">
                        {url}
                      </code>
                    </div>
                  ) : null}
                  {isDocument ? (
                    <div
                      className={cn(
                        "mt-10",
                        hasTableOfContents &&
                          "xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start xl:gap-12 2xl:grid-cols-[minmax(0,1fr)_18rem]",
                      )}
                    >
                      <article className="min-w-0">
                        {hasTableOfContents ? (
                          <DocumentationTableOfContents
                            headings={currentHeadings}
                            className="mb-8 xl:hidden"
                          />
                        ) : null}
                        {currentContent ? (
                          <RichContentRenderer
                            content={currentContent}
                            className="public-doc-content text-foreground"
                            onClickCapture={handleRichContentClick}
                          />
                        ) : (
                          <p className="text-[15px] leading-7 text-muted-foreground">
                            {currentDescription ||
                              "No description has been provided."}
                          </p>
                        )}
                      </article>
                      {hasTableOfContents ? (
                        <aside className="hidden min-w-0 xl:block">
                          <DocumentationTableOfContents
                            headings={currentHeadings}
                            className="sticky top-[calc(var(--public-doc-header-height)+1.5rem)]"
                          />
                        </aside>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-7 flex flex-col gap-6">
                      <p className="text-[15px] leading-7 text-muted-foreground">
                        {apiEndpoint.body.description ||
                          "No description has been provided."}
                      </p>
                      {currentContent ? (
                        <RichContentRenderer
                          content={currentContent}
                          className="text-[15px] leading-7 text-muted-foreground"
                          onClickCapture={handleRichContentClick}
                        />
                      ) : null}
                    </div>
                  )}

                  {!isDocument ? (
                    <>
                      <Separator className="my-8" />

                      {apiEndpoint.body.authHeader.type !== "none" ? (
                        <DocumentationSection title="Authentication">
                          <div className="rounded-lg border">
                            <div className="flex items-center justify-between gap-4 p-4">
                              <div>
                                <p className="text-sm font-medium capitalize">
                                  {apiEndpoint.body.authHeader.type}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Send credentials using the{" "}
                                  <code className="text-foreground">
                                    {apiEndpoint.body.authHeader.key ||
                                      "Authorization"}
                                  </code>{" "}
                                  header.
                                </p>
                              </div>
                              <Badge variant="outline">Header</Badge>
                            </div>
                          </div>
                        </DocumentationSection>
                      ) : null}

                      {pathParameters.length > 0 ? (
                        <RequestFieldList
                          title="Path Params"
                          items={pathParameters}
                          compact={isAiOpen}
                          values={parameters}
                          onValueChange={(path, value) =>
                            setParameters((current) => ({
                              ...current,
                              [path[0]]: String(value),
                            }))
                          }
                        />
                      ) : null}

                      {queryParameters.length > 0 ? (
                        <RequestFieldList
                          title="Query Params"
                          items={queryParameters}
                          compact={isAiOpen}
                          values={parameters}
                          onValueChange={(path, value) =>
                            setParameters((current) => ({
                              ...current,
                              [path[0]]: String(value),
                            }))
                          }
                        />
                      ) : null}

                      {otherParameters.length > 0 ? (
                        <RequestFieldList
                          title="Request Params"
                          items={otherParameters}
                          compact={isAiOpen}
                          values={parameters}
                          onValueChange={(path, value) =>
                            setParameters((current) => ({
                              ...current,
                              [path[0]]: String(value),
                            }))
                          }
                        />
                      ) : null}

                      {apiEndpoint.body.requestBody.length > 0 ? (
                        <RequestFieldList
                          title="Body Params"
                          items={apiEndpoint.body.requestBody}
                          compact={isAiOpen}
                          values={body}
                          onValueChange={(path, value) =>
                            setBody((current) =>
                              setNestedRequestValue(current, path, value),
                            )
                          }
                          coerceValues
                        />
                      ) : null}

                      {apiEndpoint.body.sampleResponses.length > 0 ? (
                        <DocumentationSection title="Responses">
                          <div className="overflow-hidden rounded-lg border">
                            {apiEndpoint.body.sampleResponses.map(
                              (response, index) => (
                                <details
                                  key={`${response.statusCode}-${index}`}
                                  className="group border-b last:border-b-0"
                                >
                                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 text-sm">
                                    <span
                                      className={cn(
                                        "size-2.5 rounded-full",
                                        response.statusCode < 400
                                          ? "bg-primary"
                                          : "bg-destructive",
                                      )}
                                    />
                                    <span className="flex min-w-0 flex-col">
                                      <span className="font-semibold">
                                        {response.statusCode}
                                      </span>
                                      <span className="truncate text-muted-foreground">
                                        {response.description}
                                      </span>
                                    </span>
                                    <ChevronRight className="ml-auto transition-transform group-open:rotate-90" />
                                  </summary>
                                  <ResponseBodyCode code={response.body} />
                                </details>
                              ),
                            )}
                          </div>
                        </DocumentationSection>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </main>

              {!isDocument ? (
                <aside
                  className={cn(
                    "public-documentation-aux-panel min-w-0 border-t bg-muted/20 px-4 py-7 sm:px-5 xl:h-full xl:overflow-y-auto xl:border-t-0",
                    isAiOpen ? "lg:px-5" : "lg:px-8",
                  )}
                >
                  <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 xl:min-h-full 2xl:gap-8">
                    <section className="min-w-0">
                      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Language
                      </p>
                      <Tabs
                        value={language}
                        onValueChange={setLanguage}
                        className="min-w-0 gap-5"
                      >
                        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4">
                          {Object.keys(examples).map((name) => (
                            <TabsTrigger
                              key={name}
                              value={name}
                              className="h-10 px-2 text-xs data-active:border data-active:bg-background sm:h-12 sm:px-3 sm:text-sm"
                            >
                              {name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {Object.entries(examples).map(([name, example]) => (
                          <TabsContent key={name} value={name} className="pt-2">
                            <CodePanel language={name} code={example} />
                          </TabsContent>
                        ))}
                      </Tabs>
                    </section>

                    <Suspense fallback={null}>
                      <EndpointTester
                        organizationSlug={organizationSlug}
                        projectSlug={projectSlug}
                        endpoint={apiEndpoint}
                        parameters={parameters}
                        body={body}
                        credential={credential}
                        onCredentialChange={setCredential}
                        variant="panel"
                        compact={isAiOpen}
                      />
                    </Suspense>
                  </div>
                </aside>
              ) : null}
            </div>
          </div>
          {isAiEnabled ? (
            <div id="public-ai-assistant">
              <PublicAiAssistant
                open={isAiOpen}
                organizationSlug={organizationSlug}
                projectSlug={projectSlug}
                currentPageTitle={currentTitle}
                currentPagePath={currentPagePath}
                displayName={data.aiSettings?.displayName ?? "AI Assistant"}
                onOpenChange={updateAiOpen}
              />
            </div>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function PublicDocumentationSidebarSync({ isAiOpen }: { isAiOpen: boolean }) {
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    if (isAiOpen) setOpenMobile(false);
  }, [isAiOpen, setOpenMobile]);

  return null;
}

type PublicDocumentationRouter = ReturnType<typeof useRouter>;

function navigatePublicDocumentationPath(
  router: PublicDocumentationRouter,
  href: string,
) {
  const url = new URL(href, window.location.href);
  const hash = url.hash.slice(1);
  const versionedReferenceMatch = url.pathname.match(
    /^\/([^/]+)\/reference\/([^/]+)\/?$/,
  );
  if (versionedReferenceMatch) {
    void router.navigate({
      to: "/$versionSlug/reference/$endpointSlug",
      params: {
        versionSlug: decodeURIComponent(versionedReferenceMatch[1]),
        endpointSlug: decodeURIComponent(versionedReferenceMatch[2]),
      },
      hash,
      viewTransition: true,
    });
    return;
  }

  const legacyVersionedReferenceMatch = url.pathname.match(
    /^\/v\/([^/]+)\/reference\/([^/]+)\/?$/,
  );
  if (legacyVersionedReferenceMatch) {
    void router.navigate({
      to: "/v/$versionSlug/reference/$endpointSlug",
      params: {
        versionSlug: decodeURIComponent(legacyVersionedReferenceMatch[1]),
        endpointSlug: decodeURIComponent(legacyVersionedReferenceMatch[2]),
      },
      hash,
      viewTransition: true,
    });
    return;
  }

  const versionedGuideMatch = url.pathname.match(
    /^\/([^/]+)\/docs\/([^/]+)\/?$/,
  );
  if (versionedGuideMatch) {
    void router.navigate({
      to: "/$versionSlug/docs/$guideSlug",
      params: {
        versionSlug: decodeURIComponent(versionedGuideMatch[1]),
        guideSlug: decodeURIComponent(versionedGuideMatch[2]),
      },
      hash,
      viewTransition: true,
    });
    return;
  }

  const legacyVersionedGuideMatch = url.pathname.match(
    /^\/v\/([^/]+)\/guides\/([^/]+)\/?$/,
  );
  if (legacyVersionedGuideMatch) {
    void router.navigate({
      to: "/v/$versionSlug/guides/$guideSlug",
      params: {
        versionSlug: decodeURIComponent(legacyVersionedGuideMatch[1]),
        guideSlug: decodeURIComponent(legacyVersionedGuideMatch[2]),
      },
      hash,
      viewTransition: true,
    });
    return;
  }

  const referenceMatch = url.pathname.match(/^\/reference\/([^/]+)\/?$/);
  if (referenceMatch) {
    void router.navigate({
      to: "/reference/$endpointSlug",
      params: { endpointSlug: decodeURIComponent(referenceMatch[1]) },
      hash,
      viewTransition: true,
    });
    return;
  }

  if (url.pathname === "/reference" || url.pathname === "/reference/") {
    void router.navigate({
      to: "/reference",
      hash,
      viewTransition: true,
    });
    return;
  }

  const guideMatch = url.pathname.match(/^\/docs\/([^/]+)\/?$/);
  if (guideMatch) {
    void router.navigate({
      to: "/docs/$guideSlug",
      params: { guideSlug: decodeURIComponent(guideMatch[1]) },
      hash,
      viewTransition: true,
    });
    return;
  }

  const legacyGuideMatch = url.pathname.match(/^\/guides\/([^/]+)\/?$/);
  if (legacyGuideMatch) {
    void router.navigate({
      to: "/guides/$guideSlug",
      params: { guideSlug: decodeURIComponent(legacyGuideMatch[1]) },
      hash,
      viewTransition: true,
    });
    return;
  }

  if (url.pathname === "/docs" || url.pathname === "/docs/") {
    void router.navigate({
      to: "/docs",
      hash,
      viewTransition: true,
    });
    return;
  }

  if (url.pathname === "/guides" || url.pathname === "/guides/") {
    void router.navigate({
      to: "/guides",
      hash,
      viewTransition: true,
    });
  }
}

function PublicDocumentationSearchDialog({
  open,
  onOpenChange,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  results,
  primaryColor,
  onResultClick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  scope: DocumentationSearchScope;
  onScopeChange: (scope: DocumentationSearchScope) => void;
  results: DocumentationSearchResult[];
  primaryColor: string;
  onResultClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeSearchText(query);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="public-documentation-search-dialog"
        showCloseButton={false}
        className="grid max-h-[min(86svh,46rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-2xl sm:w-[min(92vw,72rem)] sm:max-w-[min(92vw,72rem)]"
        style={
          {
            "--documentation-primary": primaryColor,
            "--documentation-ring": primaryColor,
            "--documentation-focus-ring":
              "color-mix(in srgb, var(--documentation-primary) 18%, transparent)",
          } as CSSProperties
        }
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <DialogTitle className="sr-only">Search documentation</DialogTitle>
        <DialogDescription className="sr-only">
          Search across guides and API reference pages.
        </DialogDescription>

        <div className="border-b bg-background p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={documentationSearchInputId}
              name={documentationSearchInputId}
              type="text"
              role="searchbox"
              value={query}
              onChange={(event) => onQueryChange(event.currentTarget.value)}
              className="h-14 appearance-none rounded-xl border bg-background pl-12 pr-12 text-base shadow-none focus-visible:ring-[var(--documentation-focus-ring)] sm:h-16 sm:text-lg"
              placeholder="Search documentation"
              aria-label="Search documentation"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              enterKeyHint="search"
              spellCheck={false}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
              >
                <X />
              </Button>
            ) : null}
          </div>

          <div
            className="mt-5 flex min-w-0 items-center gap-1 overflow-x-auto"
            aria-label="Search result filters"
          >
            <SearchScopeButton
              icon={Search}
              label="All"
              active={scope === "all"}
              onClick={() => onScopeChange("all")}
            />
            <SearchScopeButton
              icon={BookOpenText}
              label="Guides"
              active={scope === "guides"}
              onClick={() => onScopeChange("guides")}
            />
            <SearchScopeButton
              icon={CodeXml}
              label="Reference"
              active={scope === "reference"}
              onClick={() => onScopeChange("reference")}
            />
          </div>
        </div>

        <div className="min-h-[24rem] overflow-y-auto bg-background p-4 sm:min-h-[34rem] sm:p-5">
          {!trimmedQuery ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center sm:min-h-[30rem]">
              <Search className="mb-5 size-7 text-muted-foreground" />
              <p className="text-lg font-semibold text-muted-foreground">
                Start typing to search...
              </p>
            </div>
          ) : results.length ? (
            <ul className="space-y-1" role="list">
              {results.map((result) => (
                <li key={result.id}>
                  <a
                    href={result.href}
                    aria-label={`Open ${result.title}`}
                    className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--documentation-ring)]"
                    onClick={(event) => onResultClick(event, result.href)}
                  >
                    <span className="mt-0.5 flex size-8 items-center justify-center text-muted-foreground">
                      <SearchResultIcon result={result} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        {result.endpointType === "endpoint" && result.method ? (
                          <MethodBadge method={result.method} />
                        ) : null}
                        <span className="min-w-0 text-base font-semibold leading-6 text-foreground">
                          <HighlightedSearchText
                            text={result.title}
                            query={query}
                          />
                        </span>
                      </span>
                      <span className="mt-0.5 block min-w-0 text-base leading-6 text-muted-foreground">
                        <HighlightedSearchText
                          text={getDocumentationSearchSnippet(
                            result,
                            normalizedQuery,
                          )}
                          query={query}
                        />
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-[20rem] flex-col items-center justify-center text-center sm:min-h-[30rem]">
              <Search className="mb-5 size-7 text-muted-foreground" />
              <p className="text-lg font-semibold text-muted-foreground">
                No results found.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchScopeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Search;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--documentation-ring)] focus-visible:ring-offset-2",
        active ? "border-foreground text-foreground" : "border-transparent",
      )}
      onClick={onClick}
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function SearchResultIcon({ result }: { result: DocumentationSearchResult }) {
  if (result.kind === "guide") {
    return (
      <DocumentationIcon
        iconName={result.iconName}
        fallback={BookOpenText}
        className="size-4"
      />
    );
  }

  if (result.endpointType === "doc") {
    return (
      <DocumentationIcon
        iconName={result.iconName}
        fallback={FileText}
        className="size-4"
      />
    );
  }

  return <CodeXml className="size-5" />;
}

function HighlightedSearchText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return <>{text}</>;

  const matchIndex = text.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex === -1) return <>{text}</>;

  const matchEnd = matchIndex + normalizedQuery.length;

  return (
    <>
      {text.slice(0, matchIndex)}
      <mark className="bg-transparent text-inherit underline decoration-[var(--documentation-primary)] decoration-2 underline-offset-3">
        {text.slice(matchIndex, matchEnd)}
      </mark>
      {text.slice(matchEnd)}
    </>
  );
}

export function DocumentationLink({
  title,
  method,
  endpointType,
  iconName,
  isActive,
  href,
}: {
  title: string;
  method: string;
  endpointType: "endpoint" | "doc";
  iconName?: string;
  isActive: boolean;
  href: string;
}) {
  const { setOpenMobile } = useSidebar();
  const router = useRouter({ warn: false });

  return (
    <a
      href={href}
      data-active={isActive ? "true" : undefined}
      onClick={(event) => {
        setOpenMobile(false);
        if (!shouldHandlePublicDocumentationClick(event, href)) return;

        event.preventDefault();
        navigatePublicDocumentationPath(router, href);
      }}
      className={cn(
        "public-documentation-sidebar-link grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {endpointType === "doc" ? (
          <DocumentationIcon
            iconName={iconName}
            fallback={FileText}
            className="size-4 shrink-0"
          />
        ) : null}
        <span className="min-w-0 truncate">{title}</span>
      </span>
      <EndpointTypeBadge method={method} endpointType={endpointType} />
    </a>
  );
}

export function GuideDocumentationLink({
  title,
  iconName,
  isActive,
  href,
}: {
  title: string;
  iconName?: string;
  isActive: boolean;
  href: string;
}) {
  const { setOpenMobile } = useSidebar();
  const router = useRouter({ warn: false });

  return (
    <a
      href={href}
      data-active={isActive ? "true" : undefined}
      onClick={(event) => {
        setOpenMobile(false);
        if (!shouldHandlePublicDocumentationClick(event, href)) return;

        event.preventDefault();
        navigatePublicDocumentationPath(router, href);
      }}
      className={cn(
        "public-documentation-sidebar-link flex min-w-0 items-center gap-2 rounded-md px-3 py-2.5 transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <DocumentationIcon
        iconName={iconName}
        fallback={FileText}
        className="size-4 shrink-0"
      />
      <span className="min-w-0 truncate">{title}</span>
    </a>
  );
}

function EndpointTypeBadge({
  method,
  endpointType,
}: {
  method: string;
  endpointType: "endpoint" | "doc";
}) {
  if (endpointType === "doc") {
    return (
      <span className="justify-self-end text-[10px] font-semibold tracking-wide text-muted-foreground">
        DOC
      </span>
    );
  }

  return (
    <Badge
      className={cn(
        "h-5 min-w-11 justify-self-end border-0 px-1.5 font-mono text-[9px] text-white",
        method === "GET" && "bg-emerald-600",
        method === "POST" && "bg-blue-600",
        (method === "PUT" || method === "PATCH") && "bg-violet-600",
        method === "DELETE" && "bg-red-600",
        (method === "OPTIONS" || method === "HEAD") && "bg-slate-600",
      )}
    >
      {method}
    </Badge>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <Badge
      className={cn(
        "h-6 shrink-0 border-0 px-2.5 font-mono text-[11px] text-white",
        method === "GET" && "bg-emerald-600",
        method === "POST" && "bg-blue-600",
        (method === "PUT" || method === "PATCH") && "bg-violet-600",
        method === "DELETE" && "bg-red-600",
        (method === "OPTIONS" || method === "HEAD") && "bg-slate-600",
      )}
    >
      {method}
    </Badge>
  );
}

function DocumentationSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function RequestFieldList({
  title,
  items,
  values,
  onValueChange,
  pathPrefix = [],
  compact = false,
  coerceValues = false,
}: {
  title: string;
  items: FieldItem[];
  values: Record<string, unknown>;
  onValueChange: (path: string[], value: unknown) => void;
  pathPrefix?: string[];
  compact?: boolean;
  coerceValues?: boolean;
}) {
  return (
    <DocumentationSection title={title}>
      <FieldGroup className="gap-0 overflow-hidden rounded-lg border">
        {items.map((item) => {
          const itemPath = [...pathPrefix, item.name];
          const itemValue = values[item.name];
          const nestedValues: Record<string, unknown> = isRequestRecord(
            itemValue,
          )
            ? itemValue
            : {};
          const hasNestedFields =
            item.dataType === "object" && Boolean(item.fields?.length);

          return (
            <div
              key={`${item.location ?? "body"}-${itemPath.join(".")}`}
              className="border-b p-3 last:border-b-0 sm:p-4"
            >
              <div
                className={cn(
                  "min-w-0",
                  !hasNestedFields &&
                    "grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,18rem)] lg:items-start",
                  !hasNestedFields &&
                    compact &&
                    "lg:grid-cols-1 lg:items-stretch 2xl:grid-cols-[minmax(10rem,1fr)_minmax(10rem,14rem)] 2xl:items-start",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <code className="min-w-0 max-w-full break-words text-sm font-semibold">
                      {item.name}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {item.dataType}
                    </span>
                    {item.required ? (
                      <span className="text-xs font-medium text-destructive">
                        required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
                    {item.description || "No description provided."}
                  </p>
                </div>
                {!hasNestedFields ? (
                  <Input
                    id={`request-${itemPath.join("-")}`}
                    name={itemPath.join(".")}
                    form="endpoint-request-form"
                    required={item.required}
                    value={formatRequestInputValue(itemValue)}
                    onChange={(event) =>
                      onValueChange(
                        itemPath,
                        coerceValues
                          ? coerceRequestValue(
                              item.dataType,
                              event.target.value,
                            )
                          : event.target.value,
                      )
                    }
                    placeholder={item.required ? "Enter value" : "Optional"}
                    aria-label={`${title}: ${itemPath.join(".")}`}
                    className="h-10 min-w-0 bg-background sm:h-11"
                  />
                ) : null}
              </div>
              {hasNestedFields ? (
                <div className="mt-4 overflow-hidden rounded-lg border bg-background/40">
                  <RequestFieldListContent
                    title={title}
                    items={item.fields ?? []}
                    values={nestedValues}
                    onValueChange={onValueChange}
                    pathPrefix={itemPath}
                    compact={compact}
                    coerceValues={coerceValues}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </FieldGroup>
    </DocumentationSection>
  );
}

function RequestFieldListContent({
  title,
  items,
  values,
  onValueChange,
  pathPrefix,
  compact,
  coerceValues,
}: {
  title: string;
  items: FieldItem[];
  values: Record<string, unknown>;
  onValueChange: (path: string[], value: unknown) => void;
  pathPrefix: string[];
  compact: boolean;
  coerceValues: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const itemPath = [...pathPrefix, item.name];
        const itemValue = values[item.name];
        const nestedValues: Record<string, unknown> = isRequestRecord(itemValue)
          ? itemValue
          : {};
        const hasNestedFields =
          item.dataType === "object" && Boolean(item.fields?.length);

        return (
          <div
            key={itemPath.join(".")}
            className="border-b p-3 last:border-b-0 sm:p-4"
          >
            <div
              className={cn(
                "min-w-0",
                !hasNestedFields &&
                  "grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_minmax(12rem,18rem)] lg:items-start",
                !hasNestedFields &&
                  compact &&
                  "lg:grid-cols-1 lg:items-stretch 2xl:grid-cols-[minmax(10rem,1fr)_minmax(10rem,14rem)] 2xl:items-start",
              )}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <code className="min-w-0 max-w-full break-words text-sm font-semibold">
                    {item.name}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {item.dataType}
                  </span>
                  {item.required ? (
                    <span className="text-xs font-medium text-destructive">
                      required
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
                  {item.description || "No description provided."}
                </p>
              </div>
              {!hasNestedFields ? (
                <Input
                  id={`request-${itemPath.join("-")}`}
                  name={itemPath.join(".")}
                  form="endpoint-request-form"
                  required={item.required}
                  value={formatRequestInputValue(itemValue)}
                  onChange={(event) =>
                    onValueChange(
                      itemPath,
                      coerceValues
                        ? coerceRequestValue(item.dataType, event.target.value)
                        : event.target.value,
                    )
                  }
                  placeholder={item.required ? "Enter value" : "Optional"}
                  aria-label={`${title}: ${itemPath.join(".")}`}
                  className="h-10 min-w-0 bg-background sm:h-11"
                />
              ) : null}
            </div>
            {hasNestedFields ? (
              <div className="mt-4 overflow-hidden rounded-lg border bg-background/40">
                <RequestFieldListContent
                  title={title}
                  items={item.fields ?? []}
                  values={nestedValues}
                  onValueChange={onValueChange}
                  pathPrefix={itemPath}
                  compact={compact}
                  coerceValues={coerceValues}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function isRequestRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
