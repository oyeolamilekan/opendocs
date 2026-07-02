import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireProjectAccess, requireProjectRole } from "./lib/authorization";
import { getPublicProject } from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  documentationVersionStatusValidator,
  documentationVersionValidator,
} from "./lib/validators";
import { slugify } from "./lib/slug";

const DEFAULT_VERSION_NAME = "v1.0";
const DEFAULT_VERSION_SLUG = "v1.0";

function validateVersionName(name: string) {
  const normalized = name.trim();
  if (!normalized || normalized.length > 80) {
    throw appError(
      ERROR_CODES.validation,
      "Version name must be between 1 and 80 characters",
    );
  }
  return normalized;
}

async function uniqueVersionSlug(
  ctx: MutationCtx,
  projectId: Id<"apiProjects">,
  nameOrSlug: string,
  excludeId?: Id<"documentationVersions">,
) {
  const baseSlug = versionSlugify(nameOrSlug) || DEFAULT_VERSION_SLUG;
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await ctx.db
      .query("documentationVersions")
      .withIndex("by_project_slug", (q) =>
        q.eq("projectId", projectId).eq("slug", slug),
      )
      .unique();
    if (!existing || existing._id === excludeId) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

function versionSlugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/^[.-]+|[.-]+$/g, "") || slugify(value)
  );
}

async function getDefaultVersion(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"apiProjects">,
) {
  return await ctx.db
    .query("documentationVersions")
    .withIndex("by_project_default", (q) =>
      q.eq("projectId", projectId).eq("isDefault", true),
    )
    .first();
}

async function createDefaultVersion(
  ctx: MutationCtx,
  projectId: Id<"apiProjects">,
) {
  const existing = await getDefaultVersion(ctx, projectId);
  if (existing) return existing;

  const versionId = await ctx.db.insert("documentationVersions", {
    projectId,
    name: DEFAULT_VERSION_NAME,
    slug: await uniqueVersionSlug(ctx, projectId, DEFAULT_VERSION_SLUG),
    status: "published",
    isDefault: true,
    isBeta: false,
    isDeprecated: false,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(versionId))!;
}

async function copyVersionContent({
  ctx,
  projectId,
  sourceVersionId,
  targetVersionId,
}: {
  ctx: MutationCtx;
  projectId: Id<"apiProjects">;
  sourceVersionId: Id<"documentationVersions">;
  targetVersionId: Id<"documentationVersions">;
}) {
  const now = Date.now();
  const sourceVersion = await ctx.db.get(sourceVersionId);
  const versionSections = await ctx.db
    .query("apiSections")
    .withIndex("by_version_position", (q) => q.eq("versionId", sourceVersionId))
    .order("asc")
    .collect();
  const legacyApiSections = sourceVersion?.isDefault
    ? await ctx.db
        .query("apiSections")
        .withIndex("by_project_position", (q) => q.eq("projectId", projectId))
        .order("asc")
        .collect()
        .then((sections) =>
          sections.filter((section) => section.versionId === undefined),
        )
    : [];
  const sourceSections = [...versionSections, ...legacyApiSections].sort(
    (left, right) => left.position - right.position,
  );
  const apiSectionIdMap = new Map<Id<"apiSections">, Id<"apiSections">>();

  for (const section of sourceSections) {
    const sectionId = await ctx.db.insert("apiSections", {
      projectId,
      versionId: targetVersionId,
      title: section.title,
      slug: section.slug,
      position: section.position,
      legacyPublicId: section.legacyPublicId,
      updatedAt: now,
    });
    apiSectionIdMap.set(section._id, sectionId);
  }

  const versionEndpoints = await ctx.db
    .query("apiEndpoints")
    .withIndex("by_version", (q) => q.eq("versionId", sourceVersionId))
    .collect();
  const legacyEndpoints = sourceVersion?.isDefault
    ? await ctx.db
        .query("apiEndpoints")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
        .then((endpoints) =>
          endpoints.filter((endpoint) => endpoint.versionId === undefined),
        )
    : [];
  const sourceEndpoints = [...versionEndpoints, ...legacyEndpoints];
  for (const endpoint of sourceEndpoints) {
    const sectionId = apiSectionIdMap.get(endpoint.sectionId);
    if (!sectionId) continue;
    await ctx.db.insert("apiEndpoints", {
      projectId,
      versionId: targetVersionId,
      sectionId,
      title: endpoint.title,
      slug: endpoint.slug,
      endpointType: endpoint.endpointType,
      content: endpoint.content,
      markdown: endpoint.markdown,
      body: endpoint.body,
      position: endpoint.position,
      iconName: endpoint.iconName,
      legacyPublicId: endpoint.legacyPublicId,
      updatedAt: now,
    });
  }

  const versionGuideSections = await ctx.db
    .query("guideSections")
    .withIndex("by_version_position", (q) => q.eq("versionId", sourceVersionId))
    .order("asc")
    .collect();
  const legacyGuideSections = sourceVersion?.isDefault
    ? await ctx.db
        .query("guideSections")
        .withIndex("by_project_position", (q) => q.eq("projectId", projectId))
        .order("asc")
        .collect()
        .then((sections) =>
          sections.filter((section) => section.versionId === undefined),
        )
    : [];
  const sourceGuideSections = [
    ...versionGuideSections,
    ...legacyGuideSections,
  ].sort((left, right) => left.position - right.position);
  const guideSectionIdMap = new Map<Id<"guideSections">, Id<"guideSections">>();

  for (const section of sourceGuideSections) {
    const sectionId = await ctx.db.insert("guideSections", {
      projectId,
      versionId: targetVersionId,
      title: section.title,
      slug: section.slug,
      position: section.position,
      updatedAt: now,
    });
    guideSectionIdMap.set(section._id, sectionId);
  }

  const versionGuidePages = await ctx.db
    .query("guidePages")
    .withIndex("by_version", (q) => q.eq("versionId", sourceVersionId))
    .collect();
  const legacyGuidePages = sourceVersion?.isDefault
    ? await ctx.db
        .query("guidePages")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()
        .then((pages) => pages.filter((page) => page.versionId === undefined))
    : [];
  const sourceGuidePages = [...versionGuidePages, ...legacyGuidePages];
  for (const page of sourceGuidePages) {
    const sectionId = page.sectionId
      ? guideSectionIdMap.get(page.sectionId)
      : undefined;
    await ctx.db.insert("guidePages", {
      projectId,
      versionId: targetVersionId,
      sectionId,
      title: page.title,
      slug: page.slug,
      content: page.content,
      markdown: page.markdown,
      description: page.description,
      position: page.position,
      iconName: page.iconName,
      legacyPublicId: page.legacyPublicId,
      updatedAt: now,
    });
  }

  const navigationItems = await ctx.db
    .query("documentationNavigationItems")
    .withIndex("by_version_position", (q) => q.eq("versionId", sourceVersionId))
    .order("asc")
    .collect();
  for (const item of navigationItems) {
    await ctx.db.insert("documentationNavigationItems", {
      projectId,
      versionId: targetVersionId,
      label: item.label,
      href: item.href,
      position: item.position,
      isVisible: item.isVisible,
      openInNewTab: item.openInNewTab,
      updatedAt: now,
    });
  }
}

export const ensureDefault = mutation({
  args: { projectId: v.id("apiProjects") },
  returns: documentationVersionValidator,
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    return await createDefaultVersion(ctx, args.projectId);
  },
});

export const list = query({
  args: { projectId: v.id("apiProjects") },
  returns: v.array(documentationVersionValidator),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("documentationVersions")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const getBySlug = query({
  args: {
    projectId: v.id("apiProjects"),
    slug: v.string(),
  },
  returns: v.union(documentationVersionValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("documentationVersions")
      .withIndex("by_project_slug", (q) =>
        q.eq("projectId", args.projectId).eq("slug", args.slug),
      )
      .unique();
  },
});

export const publicList = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.array(documentationVersionValidator),
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    return await ctx.db
      .query("documentationVersions")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect()
      .then((versions) =>
        versions
          .filter((version) => version.status === "published")
          .sort((left, right) =>
            left.isDefault === right.isDefault
              ? right.updatedAt - left.updatedAt
              : left.isDefault
                ? -1
                : 1,
          ),
      );
  },
});

export const create = mutation({
  args: {
    projectId: v.id("apiProjects"),
    name: v.string(),
    copyFromVersionId: v.optional(v.id("documentationVersions")),
  },
  returns: documentationVersionValidator,
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    const name = validateVersionName(args.name);
    const versionId = await ctx.db.insert("documentationVersions", {
      projectId: args.projectId,
      name,
      slug: await uniqueVersionSlug(ctx, args.projectId, name),
      status: "draft",
      isDefault: false,
      isBeta: false,
      isDeprecated: false,
      createdFromVersionId: args.copyFromVersionId,
      updatedAt: Date.now(),
    });
    const version = (await ctx.db.get(versionId))!;

    if (args.copyFromVersionId) {
      const source = await ctx.db.get(args.copyFromVersionId);
      if (!source || source.projectId !== args.projectId) {
        throw appError(
          ERROR_CODES.validation,
          "Source version does not belong to this project",
        );
      }
      await copyVersionContent({
        ctx,
        projectId: args.projectId,
        sourceVersionId: source._id,
        targetVersionId: version._id,
      });
    }

    return version;
  },
});

export const update = mutation({
  args: {
    versionId: v.id("documentationVersions"),
    name: v.optional(v.string()),
    status: v.optional(documentationVersionStatusValidator),
    isDefault: v.optional(v.boolean()),
    isBeta: v.optional(v.boolean()),
    isDeprecated: v.optional(v.boolean()),
  },
  returns: documentationVersionValidator,
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw appError(ERROR_CODES.notFound, "Documentation version not found");
    }
    await requireProjectRole(ctx, version.projectId, ["owner", "admin"]);

    const patch: Partial<Doc<"documentationVersions">> = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      const name = validateVersionName(args.name);
      patch.name = name;
      patch.slug = await uniqueVersionSlug(
        ctx,
        version.projectId,
        name,
        version._id,
      );
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    if (args.isBeta !== undefined) {
      patch.isBeta = args.isBeta;
    }
    if (args.isDeprecated !== undefined) {
      patch.isDeprecated = args.isDeprecated;
    }
    if (args.isDefault !== undefined) {
      if (args.isDefault) {
        const versions = await ctx.db
          .query("documentationVersions")
          .withIndex("by_project", (q) => q.eq("projectId", version.projectId))
          .collect();
        for (const candidate of versions) {
          if (candidate._id !== version._id && candidate.isDefault) {
            await ctx.db.patch(candidate._id, {
              isDefault: false,
              updatedAt: Date.now(),
            });
          }
        }
        patch.isDefault = true;
        patch.status = "published";
      } else if (version.isDefault) {
        throw appError(
          ERROR_CODES.validation,
          "Set another version as default before unsetting this one",
        );
      }
    }

    await ctx.db.patch(version._id, patch);
    return (await ctx.db.get(version._id))!;
  },
});

export const remove = mutation({
  args: { versionId: v.id("documentationVersions") },
  returns: v.object({ deletedVersionId: v.id("documentationVersions") }),
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw appError(ERROR_CODES.notFound, "Documentation version not found");
    }
    await requireProjectRole(ctx, version.projectId, ["owner", "admin"]);
    if (version.isDefault) {
      throw appError(
        ERROR_CODES.validation,
        "Set another version as default before deleting this one",
      );
    }
    const versions = await ctx.db
      .query("documentationVersions")
      .withIndex("by_project", (q) => q.eq("projectId", version.projectId))
      .collect();
    if (versions.length <= 1) {
      throw appError(
        ERROR_CODES.validation,
        "A project must have at least one documentation version",
      );
    }

    const endpoints = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_version", (q) => q.eq("versionId", version._id))
      .collect();
    const sections = await ctx.db
      .query("apiSections")
      .withIndex("by_version", (q) => q.eq("versionId", version._id))
      .collect();
    const guidePages = await ctx.db
      .query("guidePages")
      .withIndex("by_version", (q) => q.eq("versionId", version._id))
      .collect();
    const guideSections = await ctx.db
      .query("guideSections")
      .withIndex("by_version", (q) => q.eq("versionId", version._id))
      .collect();
    const navigationItems = await ctx.db
      .query("documentationNavigationItems")
      .withIndex("by_version", (q) => q.eq("versionId", version._id))
      .collect();

    for (const endpoint of endpoints) await ctx.db.delete(endpoint._id);
    for (const section of sections) await ctx.db.delete(section._id);
    for (const page of guidePages) await ctx.db.delete(page._id);
    for (const section of guideSections) await ctx.db.delete(section._id);
    for (const item of navigationItems) await ctx.db.delete(item._id);
    await ctx.db.delete(version._id);

    return { deletedVersionId: version._id };
  },
});
