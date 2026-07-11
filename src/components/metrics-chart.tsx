import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { api } from "../../convex/_generated/api";
import type { useQuery } from "convex/react";
import { BookOpenText, Server } from "lucide-react";
import { Badge } from "./ui/badge";
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
import { Separator } from "./ui/separator";

type MetricsOverview = NonNullable<
  ReturnType<typeof useQuery<typeof api.analytics.getOverview>>
>;
type MetricsSection = "api-calls" | "top-endpoints" | "page-views";

const chartColors = ["#1d9bf0", "#25c2a0", "#ffcf4d", "#ff6b7a", "#8b7cf6"];

export function MetricsChartCard({
  overview,
  section,
}: {
  overview: MetricsOverview;
  section: MetricsSection;
}) {
  if (section === "top-endpoints") {
    return <TopResourcesChart overview={overview} mode="endpoints" />;
  }
  return (
    <SingleMetricChart
      overview={overview}
      metric={section === "page-views" ? "page" : "api"}
    />
  );
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
  const chartData = overview.buckets.map((bucket, index) => ({
    label: bucket.label,
    value: series[index]?.value ?? 0,
  }));
  const chartConfig = {
    value: { label: title, color: chartColors[0] },
  } satisfies ChartConfig;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-base">
          {formatNumber(total)} {isApi ? "Calls" : "Views"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[24rem] w-full">
          <LineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={38} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
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
  const resources = mode === "endpoints" ? overview.topEndpoints : overview.topPages;
  const title = mode === "endpoints" ? "Top Endpoints" : "Top Pages";
  const chartData = overview.buckets.map((bucket, bucketIndex) => {
    const row: Record<string, string | number> = { label: bucket.label };
    resources.forEach((resource, resourceIndex) => {
      row[`resource${resourceIndex}`] = resource.series[bucketIndex]?.value ?? 0;
    });
    return row;
  });
  const chartConfig = resources.reduce<ChartConfig>((config, resource, index) => {
    config[`resource${index}`] = {
      label: resource.path,
      color: chartColors[index % chartColors.length],
    };
    return config;
  }, {});

  return (
    <Card className="overflow-hidden">
      <div className="grid min-h-[32rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col">
          <CardHeader>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="text-base">
              {resources[0] ? `#1 ${resources[0].path}` : "No activity yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 flex-1">
            {resources.length ? (
              <ChartContainer config={chartConfig} className="h-[24rem] w-full">
                <LineChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={38} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  {resources.map((resource, index) => (
                    <Line key={resource.key} type="monotone" dataKey={`resource${index}`} stroke={`var(--color-resource${index})`} strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
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
                  <EmptyDescription>Metrics will appear after visitors use the docs.</EmptyDescription>
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
              <div key={resource.key} className="flex min-w-0 items-center gap-3">
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{resource.path}</p>
                  <p className="truncate text-xs text-muted-foreground">{resource.title}</p>
                </div>
                <Badge variant="secondary">{formatCompact(resource.count)}</Badge>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Card>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}
