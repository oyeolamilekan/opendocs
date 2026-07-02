import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireProjectAccess,
  requireProjectRole,
  requireSectionRole,
} from "./lib/authorization";
import {
  getPublicProject,
  nextSectionPosition,
  uniqueSectionSlug,
  validateTitle,
} from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  navigationSectionValidator,
  sectionValidator,
} from "./lib/validators";

export const create = mutation({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    title: v.string(),
  },
  returns: v.union(sectionValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    const title = validateTitle(args.title, "Section");
    const sectionId = await ctx.db.insert("apiSections", {
      projectId: args.projectId,
      versionId: args.versionId,
      title,
      slug: await uniqueSectionSlug(ctx, args.projectId, title),
      position: await nextSectionPosition(ctx, args.projectId),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(sectionId);
  },
});

export const list = query({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: v.array(sectionValidator),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("apiSections")
      .withIndex("by_project_position", (q) =>
        q.eq("projectId", args.projectId),
      )
      .order("asc")
      .collect();
  },
});

export const navigation = query({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
  },
  returns: v.array(navigationSectionValidator),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    return await buildNavigation(ctx, args.projectId, args.versionId);
  },
});

export const update = mutation({
  args: {
    sectionId: v.id("apiSections"),
    title: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  returns: v.union(sectionValidator, v.null()),
  handler: async (ctx, args) => {
    const { section } = await requireSectionRole(ctx, args.sectionId, [
      "owner",
      "admin",
    ]);
    const patch: {
      title?: string;
      slug?: string;
      position?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = validateTitle(args.title, "Section");
      patch.title = title;
      patch.slug = await uniqueSectionSlug(
        ctx,
        section.projectId,
        title,
        section._id,
      );
    }
    if (args.position !== undefined) {
      if (!Number.isInteger(args.position) || args.position < 0) {
        throw appError(
          ERROR_CODES.validation,
          "Section position must be a non-negative integer",
        );
      }
      patch.position = args.position;
    }

    await ctx.db.patch(section._id, patch);
    return await ctx.db.get(section._id);
  },
});

export const remove = mutation({
  args: {
    sectionId: v.id("apiSections"),
  },
  returns: v.object({ deletedSectionId: v.id("apiSections") }),
  handler: async (ctx, args) => {
    const { section } = await requireSectionRole(ctx, args.sectionId, [
      "owner",
      "admin",
    ]);
    const endpoints = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_section", (q) => q.eq("sectionId", section._id))
      .collect();

    for (const endpoint of endpoints) {
      await ctx.db.delete(endpoint._id);
    }
    await ctx.db.delete(section._id);

    return { deletedSectionId: section._id };
  },
});

export const publicNavigation = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
  },
  returns: v.array(navigationSectionValidator),
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    const version = await resolvePublicVersion(ctx, project._id, args.versionSlug);
    return await buildNavigation(ctx, project._id, version?._id);
  },
});

async function buildNavigation(
  ctx: QueryCtx,
  projectId: Id<"apiProjects">,
  versionId?: Id<"documentationVersions">,
) {
  const version = versionId ? await ctx.db.get(versionId) : null;
  const versionSections = versionId
    ? await ctx.db
        .query("apiSections")
        .withIndex("by_version_position", (q) => q.eq("versionId", versionId))
        .order("asc")
        .collect()
    : [];
  const legacySections =
    !versionId || (version?.isDefault && versionSections.length === 0)
      ? await ctx.db
          .query("apiSections")
          .withIndex("by_project_position", (q) => q.eq("projectId", projectId))
          .order("asc")
          .collect()
          .then((sections) =>
            sections.filter((section) => section.versionId === undefined),
          )
      : [];
  const sections = [...versionSections, ...legacySections].sort(
    (left, right) => left.position - right.position,
  );

  return await Promise.all(
    sections.map(async (section) => ({
      ...section,
      endpoints: await ctx.db
        .query("apiEndpoints")
        .withIndex("by_section_position", (q) => q.eq("sectionId", section._id))
        .order("asc")
        .collect()
        .then((endpoints) =>
          endpoints.map((endpoint) => ({
            _id: endpoint._id,
            title: endpoint.title,
            slug: endpoint.slug,
            endpointType: endpoint.endpointType,
            method: endpoint.body.method,
            path: endpoint.body.path,
            description: endpoint.body.description,
            position: endpoint.position,
            iconName:
              endpoint.endpointType === "doc" ? endpoint.iconName : undefined,
          })),
        ),
    })),
  );
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
