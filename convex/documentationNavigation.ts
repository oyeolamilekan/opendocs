import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireMembership,
  requireProjectAccess,
  requireProjectRole,
} from "./lib/authorization";
import { getPublicProject } from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  documentationNavigationItemValidator,
  documentationVersionValidator,
  projectValidator,
} from "./lib/validators";

const MAX_NAVIGATION_ITEMS = 12;

function validateNavigationLabel(label: string) {
  const normalized = label.trim();
  if (!normalized || normalized.length > 80) {
    throw appError(
      ERROR_CODES.validation,
      "Navigation label must be between 1 and 80 characters",
    );
  }
  return normalized;
}

function validateNavigationHref(href: string) {
  const normalized = href.trim();
  if (!normalized || normalized.length > 300) {
    throw appError(
      ERROR_CODES.validation,
      "Navigation URL must be between 1 and 300 characters",
    );
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      // Fall through to the validation error below.
    }
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    return normalized;
  }

  throw appError(
    ERROR_CODES.validation,
    "Navigation URL must be an http(s) URL or an internal path starting with /",
  );
}

async function getProjectBySlug(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  slug: string,
) {
  await requireMembership(ctx, organizationId);
  return await ctx.db
    .query("apiProjects")
    .withIndex("by_organization_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", slug),
    )
    .unique();
}

async function requireVersionForProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"apiProjects">,
  versionId: Id<"documentationVersions">,
) {
  const version = await ctx.db.get(versionId);
  if (!version || version.projectId !== projectId) {
    throw appError(
      ERROR_CODES.validation,
      "Documentation version does not belong to this project",
    );
  }
  return version;
}

async function resolvePublicVersion(
  ctx: QueryCtx,
  projectId: Id<"apiProjects">,
  versionSlug?: string,
) {
  if (versionSlug) {
    const version = await ctx.db
      .query("documentationVersions")
      .withIndex("by_project_slug", (q) =>
        q.eq("projectId", projectId).eq("slug", versionSlug),
      )
      .unique();
    if (!version || version.status !== "published") {
      throw appError(ERROR_CODES.notFound, "Documentation version not found");
    }
    return version;
  }

  return await ctx.db
    .query("documentationVersions")
    .withIndex("by_project_default", (q) =>
      q.eq("projectId", projectId).eq("isDefault", true),
    )
    .first();
}

async function listItemsByVersion(
  ctx: QueryCtx | MutationCtx,
  versionId: Id<"documentationVersions">,
) {
  return await ctx.db
    .query("documentationNavigationItems")
    .withIndex("by_version_position", (q) => q.eq("versionId", versionId))
    .order("asc")
    .collect();
}

async function nextNavigationPosition(
  ctx: QueryCtx | MutationCtx,
  versionId: Id<"documentationVersions">,
) {
  const latest = await ctx.db
    .query("documentationNavigationItems")
    .withIndex("by_version_position", (q) => q.eq("versionId", versionId))
    .order("desc")
    .first();
  return (latest?.position ?? -1) + 1;
}

export const getDashboardBySlug = query({
  args: {
    organizationId: v.id("organizations"),
    projectSlug: v.string(),
    versionSlug: v.string(),
  },
  returns: v.union(
    v.object({
      project: projectValidator,
      versions: v.array(documentationVersionValidator),
      selectedVersion: documentationVersionValidator,
      items: v.array(documentationNavigationItemValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await getProjectBySlug(
      ctx,
      args.organizationId,
      args.projectSlug,
    );
    if (!project) return null;

    const versions = await ctx.db
      .query("documentationVersions")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .order("desc")
      .collect();
    const selectedVersion = versions.find(
      (version) => version.slug === args.versionSlug,
    );
    if (!selectedVersion) return null;

    return {
      project,
      versions,
      selectedVersion,
      items: await listItemsByVersion(ctx, selectedVersion._id),
    };
  },
});

export const list = query({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.id("documentationVersions"),
  },
  returns: v.array(documentationNavigationItemValidator),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    await requireVersionForProject(ctx, args.projectId, args.versionId);
    return await listItemsByVersion(ctx, args.versionId);
  },
});

export const publicNavigation = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
  },
  returns: v.array(documentationNavigationItemValidator),
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    const version = await resolvePublicVersion(
      ctx,
      project._id,
      args.versionSlug,
    );
    if (!version) return [];

    const items = await listItemsByVersion(ctx, version._id);
    return items.filter((item) => item.isVisible);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.id("documentationVersions"),
    label: v.string(),
    href: v.string(),
    isVisible: v.optional(v.boolean()),
    openInNewTab: v.optional(v.boolean()),
  },
  returns: documentationNavigationItemValidator,
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    await requireVersionForProject(ctx, args.projectId, args.versionId);
    const existingItems = await listItemsByVersion(ctx, args.versionId);
    if (existingItems.length >= MAX_NAVIGATION_ITEMS) {
      throw appError(
        ERROR_CODES.validation,
        `Navigation can include up to ${MAX_NAVIGATION_ITEMS} items`,
      );
    }

    const itemId = await ctx.db.insert("documentationNavigationItems", {
      projectId: args.projectId,
      versionId: args.versionId,
      label: validateNavigationLabel(args.label),
      href: validateNavigationHref(args.href),
      position: await nextNavigationPosition(ctx, args.versionId),
      isVisible: args.isVisible ?? true,
      openInNewTab: args.openInNewTab ?? false,
      updatedAt: Date.now(),
    });
    return (await ctx.db.get(itemId))!;
  },
});

export const update = mutation({
  args: {
    itemId: v.id("documentationNavigationItems"),
    label: v.optional(v.string()),
    href: v.optional(v.string()),
    position: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
    openInNewTab: v.optional(v.boolean()),
  },
  returns: documentationNavigationItemValidator,
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw appError(ERROR_CODES.notFound, "Navigation item not found");
    }
    await requireProjectRole(ctx, item.projectId, ["owner", "admin"]);

    const patch: Partial<Doc<"documentationNavigationItems">> = {
      updatedAt: Date.now(),
    };
    if (args.label !== undefined) {
      patch.label = validateNavigationLabel(args.label);
    }
    if (args.href !== undefined) {
      patch.href = validateNavigationHref(args.href);
    }
    if (args.position !== undefined) {
      if (!Number.isInteger(args.position) || args.position < 0) {
        throw appError(
          ERROR_CODES.validation,
          "Navigation position must be a non-negative integer",
        );
      }
      patch.position = args.position;
    }
    if (args.isVisible !== undefined) {
      patch.isVisible = args.isVisible;
    }
    if (args.openInNewTab !== undefined) {
      patch.openInNewTab = args.openInNewTab;
    }

    await ctx.db.patch(item._id, patch);
    return (await ctx.db.get(item._id))!;
  },
});

export const reorder = mutation({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.id("documentationVersions"),
    itemIds: v.array(v.id("documentationNavigationItems")),
  },
  returns: v.array(documentationNavigationItemValidator),
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    await requireVersionForProject(ctx, args.projectId, args.versionId);
    const items = await listItemsByVersion(ctx, args.versionId);
    const itemIdSet = new Set(items.map((item) => item._id));

    if (
      args.itemIds.length !== items.length ||
      args.itemIds.some((itemId) => !itemIdSet.has(itemId))
    ) {
      throw appError(
        ERROR_CODES.validation,
        "Navigation reorder payload must include every item exactly once",
      );
    }

    const now = Date.now();
    await Promise.all(
      args.itemIds.map((itemId, position) =>
        ctx.db.patch(itemId, { position, updatedAt: now }),
      ),
    );
    return await listItemsByVersion(ctx, args.versionId);
  },
});

export const remove = mutation({
  args: {
    itemId: v.id("documentationNavigationItems"),
  },
  returns: v.object({ deletedItemId: v.id("documentationNavigationItems") }),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw appError(ERROR_CODES.notFound, "Navigation item not found");
    }
    await requireProjectRole(ctx, item.projectId, ["owner", "admin"]);
    await ctx.db.delete(item._id);
    return { deletedItemId: item._id };
  },
});
