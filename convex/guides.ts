import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getPublicProject,
  nextGuidePagePosition,
  uniqueGuidePageSlug,
  validateTitle,
} from "./lib/apiDocumentation";
import { requireProjectAccess, requireProjectRole } from "./lib/authorization";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  guidePageValidator,
  navigationGuideSectionValidator,
} from "./lib/validators";

export const create = mutation({
  args: {
    projectId: v.id("apiProjects"),
    sectionId: v.id("guideSections"),
    title: v.string(),
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.union(guidePageValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    const section = await ctx.db.get(args.sectionId);
    if (!section || section.projectId !== args.projectId) {
      throw appError(
        ERROR_CODES.validation,
        "Guide section does not belong to the selected project",
      );
    }
    const title = validateTitle(args.title, "Guide page");
    const guidePageId = await ctx.db.insert("guidePages", {
      projectId: args.projectId,
      versionId: section.versionId,
      sectionId: args.sectionId,
      title,
      slug: await uniqueGuidePageSlug(
        ctx,
        args.projectId,
        section.versionId,
        title,
      ),
      content: args.content,
      markdown: args.markdown,
      description: args.description?.trim() ?? "",
      position: await nextGuidePagePosition(ctx, args.sectionId),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(guidePageId);
  },
});

export const navigation = query({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
  },
  returns: v.array(navigationGuideSectionValidator),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    return await buildNavigation(ctx, args.projectId, args.versionId);
  },
});

export const getBySlug = query({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    slug: v.string(),
  },
  returns: v.union(guidePageValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    return await findGuidePageBySlug(
      ctx,
      args.projectId,
      args.slug,
      args.versionId,
    );
  },
});

export const update = mutation({
  args: {
    guidePageId: v.id("guidePages"),
    sectionId: v.optional(v.id("guideSections")),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    description: v.optional(v.string()),
    iconName: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  returns: v.union(guidePageValidator, v.null()),
  handler: async (ctx, args) => {
    const guidePage = await ctx.db.get(args.guidePageId);
    if (!guidePage) {
      throw appError(ERROR_CODES.notFound, "Guide page not found");
    }
    await requireProjectRole(ctx, guidePage.projectId, ["owner", "admin"]);

    const patch: {
      title?: string;
      slug?: string;
      content?: string;
      markdown?: string;
      description?: string;
      iconName?: string;
      sectionId?: Id<"guideSections">;
      position?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (
      args.sectionId !== undefined &&
      args.sectionId !== guidePage.sectionId
    ) {
      const section = await ctx.db.get(args.sectionId);
      if (!section || section.projectId !== guidePage.projectId) {
        throw appError(
          ERROR_CODES.validation,
          "Guide page cannot move to a section in another project",
        );
      }
      patch.sectionId = section._id;
      if (args.position === undefined) {
        patch.position = await nextGuidePagePosition(ctx, section._id);
      }
    }
    if (args.title !== undefined) {
      const title = validateTitle(args.title, "Guide page");
      patch.title = title;
      patch.slug = await uniqueGuidePageSlug(
        ctx,
        guidePage.projectId,
        guidePage.versionId,
        title,
        guidePage._id,
      );
    }
    if (args.content !== undefined) {
      patch.content = args.content;
    }
    if (args.markdown !== undefined) {
      patch.markdown = args.markdown;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim();
    }
    if (args.iconName !== undefined) {
      const trimmed = args.iconName.trim();
      patch.iconName = trimmed ? trimmed : undefined;
    }
    if (args.position !== undefined) {
      if (!Number.isInteger(args.position) || args.position < 0) {
        throw appError(
          ERROR_CODES.validation,
          "Guide page position must be a non-negative integer",
        );
      }
      patch.position = args.position;
    }

    await ctx.db.patch(guidePage._id, patch);
    return await ctx.db.get(guidePage._id);
  },
});

export const remove = mutation({
  args: {
    guidePageId: v.id("guidePages"),
  },
  returns: v.object({ deletedGuidePageId: v.id("guidePages") }),
  handler: async (ctx, args) => {
    const guidePage = await ctx.db.get(args.guidePageId);
    if (!guidePage) {
      throw appError(ERROR_CODES.notFound, "Guide page not found");
    }
    await requireProjectRole(ctx, guidePage.projectId, ["owner", "admin"]);
    await ctx.db.delete(guidePage._id);
    return { deletedGuidePageId: guidePage._id };
  },
});

export const publicNavigation = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
  },
  returns: v.array(navigationGuideSectionValidator),
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

export const getPublicBySlug = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
    guideSlug: v.string(),
  },
  returns: v.object({
    title: v.string(),
    slug: v.string(),
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    description: v.string(),
    position: v.number(),
    iconName: v.optional(v.string()),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    const version = await resolvePublicVersion(ctx, project._id, args.versionSlug);
    const guidePage = await findGuidePageBySlug(
      ctx,
      project._id,
      args.guideSlug,
      version?._id,
    );

    if (!guidePage) {
      throw appError(ERROR_CODES.notFound, "Public guide page not found");
    }

    return {
      title: guidePage.title,
      slug: guidePage.slug,
      content: guidePage.content,
      markdown: guidePage.markdown,
      description: guidePage.description,
      position: guidePage.position,
      iconName: guidePage.iconName,
      updatedAt: guidePage.updatedAt,
    };
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
        .query("guideSections")
        .withIndex("by_version_position", (q) => q.eq("versionId", versionId))
        .order("asc")
        .collect()
    : [];
  const legacySections =
    !versionId || (version?.isDefault && versionSections.length === 0)
      ? await ctx.db
          .query("guideSections")
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
      pages: await ctx.db
        .query("guidePages")
        .withIndex("by_section_position", (q) =>
          q.eq("sectionId", section._id),
        )
        .order("asc")
        .collect()
        .then((pages) =>
          pages.map((page) => ({
            _id: page._id,
            title: page.title,
            slug: page.slug,
            description: page.description,
            position: page.position,
            iconName: page.iconName,
          })),
        ),
    })),
  );
}

async function findGuidePageBySlug(
  ctx: QueryCtx,
  projectId: Id<"apiProjects">,
  slug: string,
  versionId?: Id<"documentationVersions">,
) {
  const version = versionId ? await ctx.db.get(versionId) : null;
  if (versionId) {
    const versionPage = await ctx.db
      .query("guidePages")
      .withIndex("by_version_slug", (q) =>
        q.eq("versionId", versionId).eq("slug", slug),
      )
      .unique();
    if (versionPage) return versionPage;
  }
  if (versionId && !version?.isDefault) return null;
  return await ctx.db
    .query("guidePages")
    .withIndex("by_project_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", slug),
    )
    .collect()
    .then(
      (pages) => pages.find((page) => page.versionId === undefined) ?? null,
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
