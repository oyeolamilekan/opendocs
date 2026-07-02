import { v } from "convex/values";
import { mutation } from "./_generated/server";
import {
  nextGuideSectionPosition,
  uniqueGuideSectionSlug,
  validateTitle,
} from "./lib/apiDocumentation";
import { requireProjectRole } from "./lib/authorization";
import { appError, ERROR_CODES } from "./lib/errors";
import { guideSectionValidator } from "./lib/validators";

export const create = mutation({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    title: v.string(),
  },
  returns: v.union(guideSectionValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    const title = validateTitle(args.title, "Guide section");
    const sectionId = await ctx.db.insert("guideSections", {
      projectId: args.projectId,
      versionId: args.versionId,
      title,
      slug: await uniqueGuideSectionSlug(ctx, args.projectId, title),
      position: await nextGuideSectionPosition(ctx, args.projectId),
      updatedAt: Date.now(),
    });

    const existingSections = args.versionId
      ? await ctx.db
          .query("guideSections")
          .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
          .collect()
      : await ctx.db
          .query("guideSections")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
          .then((sections) =>
            sections.filter((section) => section.versionId === undefined),
          );
    if (existingSections.length === 1) {
      const legacyPages = await ctx.db
        .query("guidePages")
        .withIndex("by_project_position", (q) =>
          q.eq("projectId", args.projectId),
        )
        .collect();
      for (const page of legacyPages) {
        if (!page.sectionId && page.versionId === args.versionId) {
          await ctx.db.patch(page._id, { sectionId, updatedAt: Date.now() });
        }
      }
    }

    return await ctx.db.get(sectionId);
  },
});

export const update = mutation({
  args: {
    sectionId: v.id("guideSections"),
    title: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  returns: v.union(guideSectionValidator, v.null()),
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw appError(ERROR_CODES.notFound, "Guide section not found");
    }
    await requireProjectRole(ctx, section.projectId, ["owner", "admin"]);

    const patch: {
      title?: string;
      slug?: string;
      position?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = validateTitle(args.title, "Guide section");
      patch.title = title;
      patch.slug = await uniqueGuideSectionSlug(
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
          "Guide section position must be a non-negative integer",
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
    sectionId: v.id("guideSections"),
  },
  returns: v.object({ deletedSectionId: v.id("guideSections") }),
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw appError(ERROR_CODES.notFound, "Guide section not found");
    }
    await requireProjectRole(ctx, section.projectId, ["owner", "admin"]);
    const pages = await ctx.db
      .query("guidePages")
      .withIndex("by_section", (q) => q.eq("sectionId", section._id))
      .collect();

    for (const page of pages) {
      await ctx.db.delete(page._id);
    }
    await ctx.db.delete(section._id);
    return { deletedSectionId: section._id };
  },
});
