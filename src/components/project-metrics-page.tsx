import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Activity,
  BookOpenText,
  ChevronRight,
  Clock,
  Filter,
  MousePointerClick,
  Search,
  Server,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { smoothDashboardLinkProps } from "./dashboard-navigation";
import { ProjectDashboardLoadingPage } from "./project-dashboard-loading-page";
import { ProjectParentNavigation } from "./project-editor";
import { ThemeToggle } from "./theme-toggle";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./ui/chart";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
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
import { LoadingState } from "./ui/status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

type RangeValue = "day" | "week" | "month" | "quarter" | "year";
type MetricsSection = "api-calls" | "top-endpoints" | "page-views";
type MethodFilter =
  | "all"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";
type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx" | "failed";
type MetricsOverview = NonNullable<
  ReturnType<typeof useQuery<typeof api.analytics.getOverview>>
>;

const rangeOptions: Array<{ value: RangeValue; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const methodOptions: Array<{ value: MethodFilter; label: string }> = [
  { value: "all", label: "Method" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
  { value: "OPTIONS", label: "OPTIONS" },
  { value: "HEAD", label: "HEAD" },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Status" },
  { value: "2xx", label: "2xx" },
  { value: "3xx", label: "3xx" },
  { value: "4xx", label: "4xx" },
  { value: "5xx", label: "5xx" },
  { value: "failed", label: "Failed" },
];

const chartColors = ["#1d9bf0", "#25c2a0", "#ffcf4d", "#ff6b7a", "#8b7cf6"];

const METRICS_SECTION_DETAILS: Record<
  MetricsSection,
  {
    title: string;
    description: string;
    icon: typeof Activity;
  }
> = {
  "api-calls": {
    title: "API Calls",
    description: "Total requests sent from the public docs tester.",
    icon: Activity,
  },
  "top-endpoints": {
    title: "Top Endpoints",
    description: "Most-used API reference URLs across the selected range.",
    icon: Server,
  },
  "page-views": {
    title: "Page Views",
    description: "Views across public guides and reference pages.",
    icon: BookOpenText,
  },
};

function getMetricsSectionStorageKey(
  organizationSlug: string,
  projectSlug: string,
) {
  return `adisa-project-metrics-section:${organizationSlug}:${projectSlug}`;
}

function readMetricsSection(
  organizationSlug: string,
  projectSlug: string,
): MetricsSection | null {
  try {
    const value = window.sessionStorage.getItem(
      getMetricsSectionStorageKey(organizationSlug, projectSlug),
    );
    return value === "api-calls" ||
      value === "top-endpoints" ||
      value === "page-views"
      ? value
      : null;
  } catch {
    return null;
  }
}

function persistMetricsSection(
  organizationSlug: string,
  projectSlug: string,
  section: MetricsSection,
) {
  try {
    window.sessionStorage.setItem(
      getMetricsSectionStorageKey(organizationSlug, projectSlug),
      section,
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function ProjectMetricsPage({
  organization,
  membership,
  projectSlug,
}: {
  organization: Doc<"organizations">;
  membership: Doc<"organizationMembers">;
  projectSlug: string;
}) {
  const dashboard = useQuery(api.projects.getDashboardBySlug, {
    organizationId: organization._id,
    slug: projectSlug,
  });
  const project = dashboard?.project;
  const versions = dashboard?.versions ?? [];
  const [range, setRange] = useState<RangeValue>("day");
  const [activeSection, setActiveSection] =
    useState<MetricsSection>("api-calls");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const overview = useQuery(
    api.analytics.getOverview,
    project ? { projectId: project._id, range, method, status } : "skip",
  );
  const roleLabel = membership.role === "member" ? "View only" : "Team metrics";
  const activeSectionDetails = METRICS_SECTION_DETAILS[activeSection];
  const showApiFilters = activeSection !== "page-views";
  const showRecentApiCalls =
    activeSection === "api-calls" || activeSection === "top-endpoints";
  const searchPlaceholder =
    activeSection === "page-views"
      ? "Search visited pages"
      : "Search recent API calls";

  useEffect(() => {
    const storedSection = readMetricsSection(organization.slug, projectSlug);
    if (storedSection) {
      setActiveSection(storedSection);
    }
  }, [organization.slug, projectSlug]);

  useEffect(() => {
    persistMetricsSection(organization.slug, projectSlug, activeSection);
  }, [activeSection, organization.slug, projectSlug]);

  const recentRows = useMemo(() => {
    if (!overview) return [];
    const query = search.trim().toLowerCase();
    if (!query) return overview.recentApiCalls;
    return overview.recentApiCalls.filter((row) =>
      [
        row.endpointPath,
        row.endpointTitle,
        row.operationId,
        row.method,
        String(row.status),
        row.userAgent,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [overview, search]);
  const visitedPages = useMemo(() => {
    if (!overview) return [];
    const query = search.trim().toLowerCase();
    if (!query) return overview.topPages;
    return overview.topPages.filter((page) =>
      [page.title, page.slug, page.pageType]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [overview, search]);

  if (dashboard === undefined) {
    return (
      <ProjectDashboardLoadingPage kind="metrics" label="Loading metrics" />
    );
  }

  if (dashboard === null || !project) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <Empty className="min-h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Activity />
            </EmptyMedia>
            <EmptyTitle>Project not found</EmptyTitle>
            <EmptyDescription>
              This project may have been renamed or deleted.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug: organization.slug }}
                {...smoothDashboardLinkProps}
              >
                Return to projects
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
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
        canManage={membership.role === "owner" || membership.role === "admin"}
        activeArea="metrics"
      />
      <SidebarProvider
        className="min-w-0 flex-1 overflow-x-hidden"
        style={{ "--sidebar-width": "19rem" } as CSSProperties}
      >
        <Sidebar
          collapsible="offcanvas"
          className="project-documentation-sidebar lg:left-60!"
        >
          <SidebarHeader className="project-documentation-sidebar-header border-b border-sidebar-border">
            <div className="project-documentation-title">
              <h2 className="flex items-center gap-3 text-xl font-semibold">
                <Activity className="size-5 text-primary" />
                Metrics
              </h2>
            </div>
          </SidebarHeader>

          <SidebarContent className="project-documentation-sidebar-content">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {(
                    Object.entries(METRICS_SECTION_DETAILS) as [
                      MetricsSection,
                      (typeof METRICS_SECTION_DETAILS)[MetricsSection],
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

        <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
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
                  <BreadcrumbPage>{activeSectionDetails.title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ThemeToggle className="ml-auto" />
          </header>

          <main className="dashboard-route-panel min-w-0 flex-1 overflow-x-hidden bg-background">
            <section className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="w-fit">
                      <Activity />
                      Metrics
                    </Badge>
                    <Badge variant="outline" className="w-fit">
                      {roleLabel}
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                    {activeSectionDetails.title}
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {activeSectionDetails.description}
                  </p>
                </div>

                <div className="flex w-full min-w-0 flex-col gap-3 xl:w-auto xl:items-end">
                  <div className="relative w-full xl:w-96">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={searchPlaceholder}
                      className="pl-9"
                    />
                  </div>
                  <Tabs
                    value={range}
                    onValueChange={(value) => setRange(value as RangeValue)}
                    className="w-full xl:w-auto"
                  >
                    <TabsList className="grid w-full grid-cols-5 xl:w-auto">
                      {rangeOptions.map((option) => (
                        <TabsTrigger key={option.value} value={option.value}>
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                  {showApiFilters ? (
                    <>
                      <MetricsSelect
                        value={method}
                        options={methodOptions}
                        onChange={(value) => setMethod(value as MethodFilter)}
                      />
                      <MetricsSelect
                        value={status}
                        options={statusOptions}
                        onChange={(value) => setStatus(value as StatusFilter)}
                      />
                    </>
                  ) : null}
                </div>
                <Badge variant="outline" className="w-fit">
                  <Filter />
                  Line
                </Badge>
              </div>

              {overview ? (
                <>
                  <MetricsChartCard
                    overview={overview}
                    section={activeSection}
                  />
                  {activeSection === "page-views" ? (
                    <VisitedPagesTable pages={visitedPages} />
                  ) : null}
                  {showRecentApiCalls ? (
                    <RecentApiCallsTable rows={recentRows} />
                  ) : null}
                </>
              ) : (
                <LoadingState label="Loading analytics" />
              )}
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

function MetricsSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:min-w-36 lg:w-auto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function MetricsChartCard({
  overview,
  section,
}: {
  overview: MetricsOverview;
  section: MetricsSection;
}) {
  if (section === "top-endpoints") {
    return <TopResourcesChart overview={overview} mode="endpoints" />;
  }
  if (section === "page-views") {
    return <SingleMetricChart overview={overview} metric="page" />;
  }
  return <SingleMetricChart overview={overview} metric="api" />;
}

function SingleMetricChart({
  overview,
  metric,
}: {
  overview: MetricsOverview;
  metric: "api" | "page";
}) {
  const isApi = metric === "api";
  const series = isApi ? overview.apiSeries : overview.pageSeries;
  const title = isApi ? "API Calls" : "Page Views";
  const total = isApi ? overview.totals.apiCalls : overview.totals.pageViews;
  const description = isApi
    ? `${formatNumber(total)} Calls`
    : `${formatNumber(total)} Views`;
  const chartData = overview.buckets.map((bucket, index) => ({
    label: bucket.label,
    value: series[index]?.value ?? 0,
  }));
  const chartConfig = {
    value: {
      label: title,
      color: chartColors[0],
    },
  } satisfies ChartConfig;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[24rem] w-full">
          <LineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={28}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={38}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function TopResourcesChart({
  overview,
  mode,
}: {
  overview: MetricsOverview;
  mode: "endpoints" | "pages";
}) {
  const resources =
    mode === "endpoints" ? overview.topEndpoints : overview.topPages;
  const title = mode === "endpoints" ? "Top Endpoints" : "Top Pages";
  const first = resources[0];
  const chartData = overview.buckets.map((bucket, bucketIndex) => {
    const row: Record<string, string | number> = { label: bucket.label };
    resources.forEach((resource, resourceIndex) => {
      row[`resource${resourceIndex}`] =
        resource.series[bucketIndex]?.value ?? 0;
    });
    return row;
  });
  const chartConfig = resources.reduce<ChartConfig>(
    (config, resource, index) => {
      config[`resource${index}`] = {
        label: resource.path,
        color: chartColors[index % chartColors.length],
      };
      return config;
    },
    {},
  );

  return (
    <Card className="overflow-hidden">
      <div className="grid min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="text-base">
              {first ? `#1 ${first.path}` : "No activity yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 flex-1">
            {resources.length ? (
              <ChartContainer config={chartConfig} className="h-[24rem] w-full">
                <LineChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={28}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={38}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  {resources.map((resource, index) => (
                    <Line
                      key={resource.key}
                      type="monotone"
                      dataKey={`resource${index}`}
                      stroke={`var(--color-resource${index})`}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            ) : (
              <Empty className="h-[24rem]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {mode === "endpoints" ? <Server /> : <BookOpenText />}
                  </EmptyMedia>
                  <EmptyTitle>No activity yet</EmptyTitle>
                  <EmptyDescription>
                    Metrics will appear after visitors use the docs.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 border-t p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {mode === "endpoints" ? <Server /> : <BookOpenText />}
              {mode === "endpoints" ? "URL" : "Page"}
            </div>
            <Badge variant="secondary">{resources.length}</Badge>
          </div>
          <Separator />
          <div className="flex min-w-0 flex-col gap-3">
            {resources.map((resource, index) => (
              <div
                key={resource.key}
                className="flex min-w-0 items-center gap-3"
              >
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: chartColors[index % chartColors.length],
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {resource.path}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {resource.title}
                  </p>
                </div>
                <Badge variant="secondary">
                  {formatCompact(resource.count)}
                </Badge>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Card>
  );
}

function VisitedPagesTable({ pages }: { pages: MetricsOverview["topPages"] }) {
  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Visited pages</CardTitle>
            <CardDescription>
              Public docs pages viewed in the selected range.
            </CardDescription>
          </div>
          <Badge variant="outline">
            <BookOpenText />
            {pages.length} pages
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {pages.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.key}>
                  <TableCell className="max-w-[24rem] truncate font-medium">
                    {page.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {page.pageType === "guide" ? "Guide" : "Reference"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate">
                    {page.slug || "Untitled"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(page.count)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenText />
              </EmptyMedia>
              <EmptyTitle>No page views found</EmptyTitle>
              <EmptyDescription>
                Try a broader range or wait for visitors to open the docs.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function RecentApiCallsTable({
  rows,
}: {
  rows: MetricsOverview["recentApiCalls"];
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Recent API calls</CardTitle>
            <CardDescription>
              Requests sent through the public docs tester.
            </CardDescription>
          </div>
          <Badge variant="outline">
            <Clock />
            Latest {rows.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Operation ID</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>User Agent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status >= 400 || row.status === 0
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {row.status || "Failed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.method}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    {row.endpointPath}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate">
                    {row.operationId}
                  </TableCell>
                  <TableCell>{row.durationMs} ms</TableCell>
                  <TableCell className="max-w-[15rem] truncate">
                    {row.userAgent || "Unknown"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Empty className="min-h-64 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MousePointerClick />
              </EmptyMedia>
              <EmptyTitle>No API calls found</EmptyTitle>
              <EmptyDescription>
                Try a broader range or wait for visitors to run requests.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
