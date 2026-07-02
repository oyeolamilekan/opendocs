import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  requireMembership,
  requireProjectAccess,
  requireProjectRole,
  requireRole,
} from "./lib/authorization";
import {
  getPublicProject,
  uniqueProjectSlug,
  validateBaseUrl,
  validateTitle,
} from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  DEFAULT_PROJECT_THEME_COLOR,
  type DocumentationFont,
  documentationVersionValidator,
  organizationMembershipValidator,
  projectDocumentationFontValidator,
  projectDocumentationStyleValidator,
  projectThemeColorValidator,
  projectValidator,
  projectVisibilityValidator,
} from "./lib/validators";

const DEFAULT_DOCUMENTATION_STYLE = "default" as const;
const DEFAULT_DOCUMENTATION_FONT = "sans" as const;
const BRAND_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function normalizeOptionalBrandColor(value?: string) {
  if (value === undefined) return undefined;
  const color = value.trim();
  if (!color) return "";
  if (!BRAND_COLOR_PATTERN.test(color)) {
    throw appError(
      ERROR_CODES.validation,
      "Brand color must be a 6-digit hex color",
    );
  }
  return color.toLowerCase();
}

async function getStorageUrl(
  ctx: QueryCtx,
  storageId?: Id<"_storage">,
) {
  if (!storageId) return undefined;
  return (await ctx.storage.getUrl(storageId)) ?? undefined;
}

async function getDocumentationImageName(
  ctx: QueryCtx,
  storageId?: Id<"_storage">,
) {
  if (!storageId) return undefined;
  const image = await ctx.db
    .query("documentationImages")
    .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
    .unique();
  return image?.fileName;
}

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.string(),
    baseUrl: v.string(),
    description: v.string(),
    visibility: v.optional(projectVisibilityValidator),
    themeColor: v.optional(projectThemeColorValidator),
    brandColor: v.optional(v.string()),
    documentationStyle: v.optional(projectDocumentationStyleValidator),
    documentationFont: v.optional(projectDocumentationFontValidator),
    logoStorageId: v.optional(v.id("_storage")),
    darkLogoStorageId: v.optional(v.id("_storage")),
    faviconStorageId: v.optional(v.id("_storage")),
  },
  returns: v.union(projectValidator, v.null()),
  handler: async (ctx, args) => {
    await requireRole(ctx, args.organizationId, ["owner", "admin"]);
    const organization = await ctx.db.get(args.organizationId);

    if (!organization) {
      throw appError(ERROR_CODES.notFound, "Organization not found");
    }

    const title = validateTitle(args.title, "Project");
    const baseUrl = validateBaseUrl(args.baseUrl);
    const description = args.description.trim();

    if (!description) {
      throw appError(ERROR_CODES.validation, "Project description is required");
    }

    const projectId = await ctx.db.insert("apiProjects", {
      organizationId: args.organizationId,
      title,
      slug: await uniqueProjectSlug(ctx, args.organizationId, title),
      baseUrl,
      description,
      visibility: args.visibility ?? "private",
      themeColor: args.themeColor ?? DEFAULT_PROJECT_THEME_COLOR,
      documentationStyle: args.documentationStyle ?? DEFAULT_DOCUMENTATION_STYLE,
      documentationFont: args.documentationFont ?? DEFAULT_DOCUMENTATION_FONT,
      ...(args.brandColor !== undefined
        ? { brandColor: normalizeOptionalBrandColor(args.brandColor) }
        : {}),
      ...(args.logoStorageId ? { logoStorageId: args.logoStorageId } : {}),
      ...(args.darkLogoStorageId
        ? { darkLogoStorageId: args.darkLogoStorageId }
        : {}),
      ...(args.faviconStorageId
        ? { faviconStorageId: args.faviconStorageId }
        : {}),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("documentationVersions", {
      projectId,
      name: "v1.0",
      slug: "v1.0",
      status: "published",
      isDefault: true,
      isBeta: false,
      isDeprecated: false,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(projectId);
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(projectValidator),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    return await ctx.db
      .query("apiProjects")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: v.object({
    project: projectValidator,
    membership: organizationMembershipValidator,
  }),
  handler: async (ctx, args) => {
    const { project, membership } = await requireProjectAccess(
      ctx,
      args.projectId,
    );
    return { project, membership };
  },
});

export const getBySlug = query({
  args: {
    organizationId: v.id("organizations"),
    slug: v.string(),
  },
  returns: v.union(projectValidator, v.null()),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    const project = await ctx.db
      .query("apiProjects")
      .withIndex("by_organization_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.slug),
      )
      .unique();

    if (!project) {
      return null;
    }

    return project;
  },
});

export const getDashboardBySlug = query({
  args: {
    organizationId: v.id("organizations"),
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      project: projectValidator,
      versions: v.array(documentationVersionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    const project = await ctx.db
      .query("apiProjects")
      .withIndex("by_organization_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.slug),
      )
      .unique();

    if (!project) {
      return null;
    }

    const versions = await ctx.db
      .query("documentationVersions")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .order("desc")
      .collect();

    return { project, versions };
  },
});

export const getSettingsBySlug = query({
  args: {
    organizationId: v.id("organizations"),
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      project: projectValidator,
      logoUrl: v.optional(v.string()),
      logoFileName: v.optional(v.string()),
      darkLogoUrl: v.optional(v.string()),
      darkLogoFileName: v.optional(v.string()),
      faviconUrl: v.optional(v.string()),
      faviconFileName: v.optional(v.string()),
      versions: v.array(documentationVersionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    const project = await ctx.db
      .query("apiProjects")
      .withIndex("by_organization_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.slug),
      )
      .unique();

    if (!project) {
      return null;
    }

    const [
      logoUrl,
      logoFileName,
      darkLogoUrl,
      darkLogoFileName,
      faviconUrl,
      faviconFileName,
      versions,
    ] = await Promise.all([
      getStorageUrl(ctx, project.logoStorageId),
      getDocumentationImageName(ctx, project.logoStorageId),
      getStorageUrl(ctx, project.darkLogoStorageId),
      getDocumentationImageName(ctx, project.darkLogoStorageId),
      getStorageUrl(ctx, project.faviconStorageId),
      getDocumentationImageName(ctx, project.faviconStorageId),
      ctx.db
        .query("documentationVersions")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .order("desc")
        .collect(),
    ]);

    return {
      project,
      logoUrl,
      logoFileName,
      darkLogoUrl,
      darkLogoFileName,
      faviconUrl,
      faviconFileName,
      versions,
    };
  },
});

export const update = mutation({
  args: {
    projectId: v.id("apiProjects"),
    title: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(projectVisibilityValidator),
    themeColor: v.optional(projectThemeColorValidator),
    brandColor: v.optional(v.string()),
    documentationStyle: v.optional(projectDocumentationStyleValidator),
    documentationFont: v.optional(projectDocumentationFontValidator),
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    darkLogoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    faviconStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: v.union(projectValidator, v.null()),
  handler: async (ctx, args) => {
    const { project } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "admin",
    ]);
    const patch: {
      title?: string;
      slug?: string;
      baseUrl?: string;
      description?: string;
      visibility?: "private" | "public";
      themeColor?:
        | "emerald"
        | "blue"
        | "violet"
        | "rose"
        | "orange"
        | "slate";
      brandColor?: string;
      documentationStyle?: "default" | "compact" | "editorial";
      documentationFont?: DocumentationFont;
      logoStorageId?: Id<"_storage">;
      darkLogoStorageId?: Id<"_storage">;
      faviconStorageId?: Id<"_storage">;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) {
      const title = validateTitle(args.title, "Project");
      patch.title = title;
      patch.slug = await uniqueProjectSlug(
        ctx,
        project.organizationId,
        title,
        project._id,
      );
    }
    if (args.baseUrl !== undefined) {
      patch.baseUrl = validateBaseUrl(args.baseUrl);
    }
    if (args.description !== undefined) {
      const description = args.description.trim();
      if (!description) {
        throw appError(
          ERROR_CODES.validation,
          "Project description is required",
        );
      }
      patch.description = description;
    }
    if (args.visibility !== undefined) {
      patch.visibility = args.visibility;
    }
    if (args.themeColor !== undefined) {
      patch.themeColor = args.themeColor;
    }
    if (args.brandColor !== undefined) {
      patch.brandColor = normalizeOptionalBrandColor(args.brandColor);
    }
    if (args.documentationStyle !== undefined) {
      patch.documentationStyle = args.documentationStyle;
    }
    if (args.documentationFont !== undefined) {
      patch.documentationFont = args.documentationFont;
    }
    if (args.logoStorageId !== undefined) {
      patch.logoStorageId = args.logoStorageId ?? undefined;
    }
    if (args.darkLogoStorageId !== undefined) {
      patch.darkLogoStorageId = args.darkLogoStorageId ?? undefined;
    }
    if (args.faviconStorageId !== undefined) {
      patch.faviconStorageId = args.faviconStorageId ?? undefined;
    }

    await ctx.db.patch(project._id, patch);
    return await ctx.db.get(project._id);
  },
});

export const remove = mutation({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: v.object({ deletedProjectId: v.id("apiProjects") }),
  handler: async (ctx, args) => {
    const { project } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "admin",
    ]);
    const endpoints = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const sections = await ctx.db
      .query("apiSections")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const images = await ctx.db
      .query("documentationImages")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const guidePages = await ctx.db
      .query("guidePages")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const guideSections = await ctx.db
      .query("guideSections")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const aiSettings = await ctx.db
      .query("projectAiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const aiConversations = await ctx.db
      .query("projectAiConversations")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const versions = await ctx.db
      .query("documentationVersions")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const navigationItems = await ctx.db
      .query("documentationNavigationItems")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();

    for (const endpoint of endpoints) {
      await ctx.db.delete(endpoint._id);
    }
    for (const section of sections) {
      await ctx.db.delete(section._id);
    }
    for (const guidePage of guidePages) {
      await ctx.db.delete(guidePage._id);
    }
    for (const guideSection of guideSections) {
      await ctx.db.delete(guideSection._id);
    }
    for (const settings of aiSettings) {
      await ctx.db.delete(settings._id);
    }
    for (const conversation of aiConversations) {
      await ctx.db.delete(conversation._id);
    }
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }
    for (const item of navigationItems) {
      await ctx.db.delete(item._id);
    }
    for (const image of images) {
      await ctx.storage.delete(image.storageId);
      await ctx.db.delete(image._id);
    }
    await ctx.db.delete(project._id);

    return { deletedProjectId: project._id };
  },
});

export const getPublic = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.object({
    organization: v.object({
      name: v.string(),
      slug: v.string(),
    }),
    project: v.object({
      title: v.string(),
      slug: v.string(),
      baseUrl: v.string(),
      description: v.string(),
      visibility: projectVisibilityValidator,
      themeColor: projectThemeColorValidator,
      brandColor: v.optional(v.string()),
      documentationStyle: projectDocumentationStyleValidator,
      documentationFont: projectDocumentationFontValidator,
      logoUrl: v.optional(v.string()),
      darkLogoUrl: v.optional(v.string()),
      faviconUrl: v.optional(v.string()),
      updatedAt: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const { organization, project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    return {
      organization: {
        name: organization.name,
        slug: organization.slug,
      },
      project: {
        title: project.title,
        slug: project.slug,
        baseUrl: project.baseUrl,
        description: project.description,
        visibility: project.visibility,
        themeColor:
          project.themeColor ?? DEFAULT_PROJECT_THEME_COLOR,
        brandColor: project.brandColor,
        documentationStyle:
          project.documentationStyle ?? DEFAULT_DOCUMENTATION_STYLE,
        documentationFont: project.documentationFont ?? DEFAULT_DOCUMENTATION_FONT,
        logoUrl: await getStorageUrl(ctx, project.logoStorageId),
        darkLogoUrl: await getStorageUrl(ctx, project.darkLogoStorageId),
        faviconUrl: await getStorageUrl(ctx, project.faviconStorageId),
        updatedAt: project.updatedAt,
      },
    };
  },
});

export const getPublicByDomain = query({
  args: {
    projectSlug: v.string(),
  },
  returns: v.union(
    v.object({
      organizationSlug: v.string(),
      projectSlug: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("apiProjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.projectSlug))
      .collect();
    const publicProjects = projects.filter(
      (project) => project.visibility === "public",
    );

    if (publicProjects.length !== 1) {
      return null;
    }

    const project = publicProjects[0];
    const organization = await ctx.db.get(project.organizationId);

    if (!organization) {
      return null;
    }

    return {
      organizationSlug: organization.slug,
      projectSlug: project.slug,
    };
  },
});
