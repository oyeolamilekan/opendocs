import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getPublicProject } from "./lib/apiDocumentation";
import { requireProjectAccess } from "./lib/authorization";

const analyticsRangeValidator = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
  v.literal("quarter"),
  v.literal("year"),
);

const analyticsMethodFilterValidator = v.union(
  v.literal("all"),
  v.literal("GET"),
  v.literal("POST"),
  v.literal("PUT"),
  v.literal("PATCH"),
  v.literal("DELETE"),
  v.literal("OPTIONS"),
  v.literal("HEAD"),
);

const analyticsStatusFilterValidator = v.union(
  v.literal("all"),
  v.literal("2xx"),
  v.literal("3xx"),
  v.literal("4xx"),
  v.literal("5xx"),
  v.literal("failed"),
);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type AnalyticsEvent = Doc<"analyticsEvents">;
type AnalyticsCounter = Doc<"analyticsCounters">;
type RangeValue = "day" | "week" | "month" | "quarter" | "year";
type StatusFilter = "all" | "2xx" | "3xx" | "4xx" | "5xx" | "failed";
type StatusBucket = Exclude<StatusFilter, "all">;
type MethodFilter =
  | "all"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";
type BucketSize = "hour" | "day";

const RECENT_API_CALL_LIMIT = 50;
const RECENT_API_CALL_SCAN_LIMIT = 250;

export const recordPageView = mutation({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
    pageType: v.union(v.literal("guide"), v.literal("reference")),
    pageSlug: v.string(),
    pageTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    const now = Date.now();
    const bucketHourStart = startOfHour(now);
    const bucketDayStart = startOfDay(now);
    const pageTitle = truncate(args.pageTitle, 180);
    const pageSlug = truncate(args.pageSlug, 180);
    const pageKey = `page:${args.pageType}:${pageSlug}`;

    await ctx.db.insert("analyticsEvents", {
      projectId: project._id,
      eventType: "page_view",
      createdAt: now,
      bucketHourStart,
      bucketDayStart,
      versionSlug: args.versionSlug,
      pageType: args.pageType,
      pageSlug,
      pageTitle,
    });

    await incrementCounter(ctx, {
      projectId: project._id,
      eventType: "page_view",
      bucketSize: "hour",
      bucketStart: bucketHourStart,
      dimensionKey: "total",
      dimensionLabel: "Page views",
    });
    await incrementCounter(ctx, {
      projectId: project._id,
      eventType: "page_view",
      bucketSize: "day",
      bucketStart: bucketDayStart,
      dimensionKey: "total",
      dimensionLabel: "Page views",
    });
    await incrementCounter(ctx, {
      projectId: project._id,
      eventType: "page_view",
      bucketSize: "hour",
      bucketStart: bucketHourStart,
      dimensionKey: pageKey,
      dimensionLabel: pageTitle || pageSlug,
      dimensionSlug: pageSlug,
    });
    await incrementCounter(ctx, {
      projectId: project._id,
      eventType: "page_view",
      bucketSize: "day",
      bucketStart: bucketDayStart,
      dimensionKey: pageKey,
      dimensionLabel: pageTitle || pageSlug,
      dimensionSlug: pageSlug,
    });
  },
});

export const recordApiCall = mutation({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
    endpointSlug: v.string(),
    endpointTitle: v.string(),
    endpointPath: v.string(),
    method: v.union(
      v.literal("GET"),
      v.literal("POST"),
      v.literal("PUT"),
      v.literal("PATCH"),
      v.literal("DELETE"),
      v.literal("OPTIONS"),
      v.literal("HEAD"),
    ),
    status: v.number(),
    durationMs: v.number(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    const now = Date.now();
    const bucketHourStart = startOfHour(now);
    const bucketDayStart = startOfDay(now);
    const endpointPath = normalizePath(args.endpointPath);
    const endpointTitle = truncate(args.endpointTitle, 180);
    const endpointSlug = truncate(args.endpointSlug, 180);
    const durationMs = Math.max(0, Math.round(args.durationMs));
    const status = Math.max(0, Math.round(args.status));
    const statusBucket = statusBucketFor(status);
    const userAgent = args.userAgent ? truncate(args.userAgent, 180) : undefined;

    await ctx.db.insert("analyticsEvents", {
      projectId: project._id,
      eventType: "api_call",
      createdAt: now,
      bucketHourStart,
      bucketDayStart,
      versionSlug: args.versionSlug,
      method: args.method,
      status,
      durationMs,
      endpointSlug,
      endpointTitle,
      endpointPath,
      userAgent,
    });

    const apiCounterDimensions = [
      {
        dimensionKey: "total",
        dimensionLabel: "API calls",
      },
      {
        dimensionKey: apiAggregateDimensionKey(args.method, "all"),
        dimensionLabel: args.method,
        method: args.method,
      },
      {
        dimensionKey: apiAggregateDimensionKey("all", statusBucket),
        dimensionLabel: statusBucket,
      },
      {
        dimensionKey: apiAggregateDimensionKey(args.method, statusBucket),
        dimensionLabel: `${args.method} ${statusBucket}`,
        method: args.method,
      },
      {
        dimensionKey: endpointDimensionKey(endpointPath, "all", "all"),
        dimensionLabel: endpointTitle || endpointPath,
        dimensionSlug: endpointSlug,
        dimensionPath: endpointPath,
        method: args.method,
      },
      {
        dimensionKey: endpointDimensionKey(endpointPath, args.method, "all"),
        dimensionLabel: endpointTitle || endpointPath,
        dimensionSlug: endpointSlug,
        dimensionPath: endpointPath,
        method: args.method,
      },
      {
        dimensionKey: endpointDimensionKey(endpointPath, "all", statusBucket),
        dimensionLabel: endpointTitle || endpointPath,
        dimensionSlug: endpointSlug,
        dimensionPath: endpointPath,
        method: args.method,
      },
      {
        dimensionKey: endpointDimensionKey(
          endpointPath,
          args.method,
          statusBucket,
        ),
        dimensionLabel: endpointTitle || endpointPath,
        dimensionSlug: endpointSlug,
        dimensionPath: endpointPath,
        method: args.method,
      },
    ];

    for (const bucket of [
      { bucketSize: "hour" as const, bucketStart: bucketHourStart },
      { bucketSize: "day" as const, bucketStart: bucketDayStart },
    ]) {
      for (const dimension of apiCounterDimensions) {
        await incrementCounter(ctx, {
          projectId: project._id,
          eventType: "api_call",
          ...bucket,
          ...dimension,
        });
      }
    }
  },
});

export const getOverview = query({
  args: {
    projectId: v.id("apiProjects"),
    range: analyticsRangeValidator,
    method: analyticsMethodFilterValidator,
    status: analyticsStatusFilterValidator,
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);

    const bounds = getRangeBounds(args.range, Date.now());
    const bucketSize = counterBucketSizeForRange(args.range);
    const [apiCounters, pageCounters, recentApiEvents] = await Promise.all([
      collectCounters(
        ctx,
        args.projectId,
        "api_call",
        bucketSize,
        bounds.start,
        bounds.end,
      ),
      collectCounters(
        ctx,
        args.projectId,
        "page_view",
        bucketSize,
        bounds.start,
        bounds.end,
      ),
      collectRecentApiCalls(
        ctx,
        args.projectId,
        args.method,
        args.status,
        bounds.start,
        bounds.end,
      ),
    ]);
    const buckets = makeBuckets(bounds.start, bounds.end, bounds.intervalMs);
    const apiDimensionKey = apiAggregateDimensionKey(
      args.method,
      args.status,
    );
    const apiSeries = buildCounterSeries(
      buckets,
      apiCounters,
      bounds.intervalMs,
      apiDimensionKey,
    );
    const pageSeries = buildCounterSeries(
      buckets,
      pageCounters,
      bounds.intervalMs,
      "total",
    );
    const topEndpoints = buildTopEndpointSeries(
      buckets,
      apiCounters,
      bounds.intervalMs,
      args.method,
      args.status,
    );
    const topPages = buildTopPageSeries(
      buckets,
      pageCounters,
      bounds.intervalMs,
    );

    return {
      range: {
        start: bounds.start,
        end: bounds.end,
        intervalMs: bounds.intervalMs,
      },
      buckets: buckets.map((bucketStart) => ({
        bucketStart,
        label: formatBucketLabel(bucketStart, args.range),
      })),
      totals: {
        apiCalls: sumCounters(apiCounters, apiDimensionKey),
        pageViews: sumCounters(pageCounters, "total"),
      },
      apiSeries,
      pageSeries,
      topEndpoints,
      topPages,
      recentApiCalls: recentApiEvents.map(formatRecentApiCall),
    };
  },
});

async function collectCounters(
  ctx: QueryCtx,
  projectId: Id<"apiProjects">,
  eventType: "api_call" | "page_view",
  bucketSize: BucketSize,
  start: number,
  end: number,
) {
  return await ctx.db
    .query("analyticsCounters")
    .withIndex("by_project_event_bucket", (q) =>
      q
        .eq("projectId", projectId)
        .eq("eventType", eventType)
        .eq("bucketSize", bucketSize)
        .gte("bucketStart", start),
    )
    .collect()
    .then((counters) => counters.filter((counter) => counter.bucketStart < end));
}

async function collectRecentApiCalls(
  ctx: QueryCtx,
  projectId: Id<"apiProjects">,
  method: MethodFilter,
  status: StatusFilter,
  start: number,
  end: number,
) {
  const events = await ctx.db
    .query("analyticsEvents")
    .withIndex("by_project_type_created", (q) =>
      q
        .eq("projectId", projectId)
        .eq("eventType", "api_call")
        .gte("createdAt", start),
    )
    .order("desc")
    .take(RECENT_API_CALL_SCAN_LIMIT);

  return events
    .filter(
      (event) =>
        event.createdAt < end &&
        matchesMethod(event, method) &&
        matchesStatus(event, status),
    )
    .slice(0, RECENT_API_CALL_LIMIT);
}

async function incrementCounter(
  ctx: MutationCtx,
  value: {
    projectId: Id<"apiProjects">;
    eventType: "api_call" | "page_view";
    bucketSize: "hour" | "day";
    bucketStart: number;
    dimensionKey: string;
    dimensionLabel: string;
    dimensionSlug?: string;
    dimensionPath?: string;
    method?: string;
  },
) {
  const existing = await ctx.db
    .query("analyticsCounters")
    .withIndex("by_project_counter", (q) =>
      q
        .eq("projectId", value.projectId)
        .eq("eventType", value.eventType)
        .eq("bucketSize", value.bucketSize)
        .eq("bucketStart", value.bucketStart)
        .eq("dimensionKey", value.dimensionKey),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      dimensionLabel: value.dimensionLabel,
      dimensionSlug: value.dimensionSlug,
      dimensionPath: value.dimensionPath,
      method: value.method,
      updatedAt: Date.now(),
    });
    return;
  }

  await ctx.db.insert("analyticsCounters", {
    ...value,
    count: 1,
    updatedAt: Date.now(),
  });
}

function getRangeBounds(range: RangeValue, now: number) {
  if (range === "day") {
    const start = startOfDay(now);
    return { start, end: start + DAY, intervalMs: HOUR };
  }

  if (range === "week") {
    const end = startOfDay(now) + DAY;
    return { start: end - 7 * DAY, end, intervalMs: DAY };
  }

  if (range === "month") {
    const end = startOfDay(now) + DAY;
    return { start: end - 30 * DAY, end, intervalMs: DAY };
  }

  if (range === "quarter") {
    const end = startOfDay(now) + DAY;
    return { start: end - 90 * DAY, end, intervalMs: DAY };
  }

  const end = startOfDay(now) + DAY;
  return { start: end - 365 * DAY, end, intervalMs: 7 * DAY };
}

function makeBuckets(start: number, end: number, intervalMs: number) {
  const buckets: number[] = [];
  for (let bucket = start; bucket < end; bucket += intervalMs) {
    buckets.push(bucket);
  }
  return buckets;
}

function counterBucketSizeForRange(range: RangeValue): BucketSize {
  return range === "day" ? "hour" : "day";
}

function buildCounterSeries(
  buckets: number[],
  counters: AnalyticsCounter[],
  intervalMs: number,
  dimensionKey: string,
) {
  const counts = new Map<number, number>();
  for (const counter of counters) {
    if (counter.dimensionKey !== dimensionKey) continue;
    const bucketStart = bucketFor(
      counter.bucketStart,
      buckets[0] ?? 0,
      intervalMs,
    );
    counts.set(bucketStart, (counts.get(bucketStart) ?? 0) + counter.count);
  }
  return buckets.map((bucketStart) => ({
    bucketStart,
    value: counts.get(bucketStart) ?? 0,
  }));
}

function sumCounters(counters: AnalyticsCounter[], dimensionKey: string) {
  return counters.reduce(
    (sum, counter) =>
      counter.dimensionKey === dimensionKey ? sum + counter.count : sum,
    0,
  );
}

function buildTopEndpointSeries(
  buckets: number[],
  counters: AnalyticsCounter[],
  intervalMs: number,
  method: MethodFilter,
  status: StatusFilter,
) {
  const prefix = endpointDimensionPrefix(method, status);
  const groups = new Map<
    string,
    {
      key: string;
      title: string;
      path: string;
      slug: string;
      method: string;
      count: number;
      counters: AnalyticsCounter[];
    }
  >();

  for (const counter of counters) {
    if (!counter.dimensionKey.startsWith(prefix)) continue;
    const path = counter.dimensionPath ?? counter.dimensionKey.slice(prefix.length);
    const key = counter.dimensionKey;
    const existing =
      groups.get(key) ??
      {
        key,
        title: counter.dimensionLabel || path,
        path,
        slug: counter.dimensionSlug ?? "",
        method: counter.method ?? (method === "all" ? "GET" : method),
        count: 0,
        counters: [],
      };
    existing.count += counter.count;
    existing.counters.push(counter);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 50)
    .map((group) => ({
      key: group.key,
      title: group.title,
      path: group.path,
      slug: group.slug,
      method: group.method,
      count: group.count,
      series: buildCounterSeries(buckets, group.counters, intervalMs, group.key),
    }));
}

function buildTopPageSeries(
  buckets: number[],
  counters: AnalyticsCounter[],
  intervalMs: number,
) {
  const groups = new Map<
    string,
    {
      key: string;
      title: string;
      path: string;
      slug: string;
      pageType: string;
      count: number;
      counters: AnalyticsCounter[];
    }
  >();

  for (const counter of counters) {
    if (!counter.dimensionKey.startsWith("page:")) continue;
    const [, pageType = "reference", ...slugParts] =
      counter.dimensionKey.split(":");
    const slug = counter.dimensionSlug ?? slugParts.join(":");
    const title = (counter.dimensionLabel ?? slug) || "Untitled page";
    const key = counter.dimensionKey;
    const existing =
      groups.get(key) ??
      {
        key,
        title,
        path: title,
        slug,
        pageType,
        count: 0,
        counters: [],
      };
    existing.count += counter.count;
    existing.counters.push(counter);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((group) => ({
      key: group.key,
      title: group.title,
      path: group.path,
      slug: group.slug,
      pageType: group.pageType,
      count: group.count,
      series: buildCounterSeries(buckets, group.counters, intervalMs, group.key),
    }));
}

function formatRecentApiCall(event: AnalyticsEvent) {
  return {
    id: event._id,
    createdAt: event.createdAt,
    status: event.status ?? 0,
    method: event.method ?? "GET",
    endpointSlug: event.endpointSlug ?? "",
    endpointTitle: event.endpointTitle ?? "Untitled endpoint",
    endpointPath: event.endpointPath ?? "/",
    durationMs: event.durationMs ?? 0,
    operationId: buildOperationId(
      event.method ?? "GET",
      event.endpointSlug ?? event.endpointPath ?? "endpoint",
    ),
    userAgent: event.userAgent ?? "",
  };
}

function statusBucketFor(status: number): StatusBucket {
  if (status === 0) return "failed";
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "failed";
}

function apiAggregateDimensionKey(
  method: MethodFilter,
  status: StatusFilter,
) {
  if (method === "all" && status === "all") return "total";
  if (status === "all") return `method:${method}`;
  if (method === "all") return `status:${status}`;
  return `method-status:${method}:${status}`;
}

function endpointDimensionKey(
  endpointPath: string,
  method: MethodFilter,
  status: StatusFilter,
) {
  return `${endpointDimensionPrefix(method, status)}${endpointPath}`;
}

function endpointDimensionPrefix(method: MethodFilter, status: StatusFilter) {
  if (method === "all" && status === "all") return "endpoint:";
  if (status === "all") return `method:${method}:endpoint:`;
  if (method === "all") return `status:${status}:endpoint:`;
  return `method-status:${method}:${status}:endpoint:`;
}

function bucketFor(value: number, start: number, intervalMs: number) {
  return start + Math.floor((value - start) / intervalMs) * intervalMs;
}

function matchesMethod(event: AnalyticsEvent, method: MethodFilter) {
  return method === "all" || event.method === method;
}

function matchesStatus(event: AnalyticsEvent, status: StatusFilter) {
  if (status === "all") return true;
  const value = event.status ?? 0;
  if (status === "failed") return value === 0;
  if (status === "2xx") return value >= 200 && value < 300;
  if (status === "3xx") return value >= 300 && value < 400;
  if (status === "4xx") return value >= 400 && value < 500;
  return value >= 500 && value < 600;
}

function buildOperationId(method: string, slugOrPath: string) {
  const suffix = slugOrPath
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${method.toLowerCase()}_${suffix || "endpoint"}`;
}

function formatBucketLabel(bucketStart: number, range: RangeValue) {
  const date = new Date(bucketStart);
  if (range === "day") {
    const hour = date.getUTCHours();
    if (hour === 0) return "12 am";
    if (hour === 12) return "12 pm";
    return hour > 12 ? `${hour - 12} pm` : `${hour} am`;
  }
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function normalizePath(value: string) {
  const path = truncate(value.trim() || "/", 220);
  return path.startsWith("/") ? path : `/${path}`;
}

function truncate(value: string, maxLength: number) {
  const text = value.trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function startOfHour(value: number) {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date.getTime();
}

function startOfDay(value: number) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}
