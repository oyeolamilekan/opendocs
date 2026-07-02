import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { appError, ERROR_CODES } from "./errors";
import { slugify } from "./slug";

type DatabaseCtx = QueryCtx | MutationCtx;

export const emptyEndpointBody: Doc<"apiEndpoints">["body"] = {
  method: "GET",
  path: "",
  description: "",
  parameters: [],
  requestBody: [],
  authHeader: {
    type: "none",
    key: "",
    value: "",
  },
  sampleResponses: [],
};

export function validateTitle(title: string, entity: string) {
  const normalized = title.trim();

  if (!normalized || normalized.length > 250) {
    throw appError(
      ERROR_CODES.validation,
      `${entity} title must be between 1 and 250 characters`,
    );
  }

  return normalized;
}

export function validateBaseUrl(baseUrl: string) {
  const normalized = baseUrl.trim();

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw appError(
      ERROR_CODES.validation,
      "Base URL must be a valid HTTP or HTTPS URL",
    );
  }

  return normalized;
}

export async function uniqueProjectSlug(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  title: string,
  excludeId?: Id<"apiProjects">,
) {
  return uniqueScopedSlug(
    title,
    async (slug) =>
      await ctx.db
        .query("apiProjects")
        .withIndex("by_organization_slug", (q) =>
          q.eq("organizationId", organizationId).eq("slug", slug),
        )
        .unique(),
    excludeId,
  );
}

export async function uniqueSectionSlug(
  ctx: MutationCtx,
  projectId: Id<"apiProjects">,
  title: string,
  excludeId?: Id<"apiSections">,
) {
  return uniqueScopedSlug(
    title,
    async (slug) =>
      await ctx.db
        .query("apiSections")
        .withIndex("by_project_slug", (q) =>
          q.eq("projectId", projectId).eq("slug", slug),
        )
        .unique(),
    excludeId,
  );
}

export async function uniqueEndpointSlug(
  ctx: MutationCtx,
  projectId: Id<"apiProjects">,
  title: string,
  excludeId?: Id<"apiEndpoints">,
) {
  return uniqueScopedSlug(
    title,
    async (slug) =>
      await ctx.db
        .query("apiEndpoints")
        .withIndex("by_project_slug", (q) =>
          q.eq("projectId", projectId).eq("slug", slug),
        )
        .unique(),
    excludeId,
  );
}

export async function uniqueGuidePageSlug(
  ctx: MutationCtx,
  projectId: Id<"apiProjects">,
  title: string,
  excludeId?: Id<"guidePages">,
) {
  return uniqueScopedSlug(
    title,
    async (slug) =>
      await ctx.db
        .query("guidePages")
        .withIndex("by_project_slug", (q) =>
          q.eq("projectId", projectId).eq("slug", slug),
        )
        .unique(),
    excludeId,
  );
}

export async function uniqueGuideSectionSlug(
  ctx: MutationCtx,
  projectId: Id<"apiProjects">,
  title: string,
  excludeId?: Id<"guideSections">,
) {
  return uniqueScopedSlug(
    title,
    async (slug) =>
      await ctx.db
        .query("guideSections")
        .withIndex("by_project_slug", (q) =>
          q.eq("projectId", projectId).eq("slug", slug),
        )
        .unique(),
    excludeId,
  );
}

async function uniqueScopedSlug<
  T extends {
    _id:
      | Id<"apiProjects">
      | Id<"apiSections">
      | Id<"apiEndpoints">
      | Id<"guideSections">
      | Id<"guidePages">;
  },
>(
  title: string,
  findBySlug: (slug: string) => Promise<T | null>,
  excludeId?: T["_id"],
) {
  const baseSlug = slugify(title);

  if (!baseSlug) {
    throw appError(
      ERROR_CODES.validation,
      "Title must contain letters or numbers",
    );
  }

  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await findBySlug(slug);
    if (!existing || existing._id === excludeId) {
      return slug;
    }
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function nextSectionPosition(
  ctx: DatabaseCtx,
  projectId: Id<"apiProjects">,
) {
  const last = await ctx.db
    .query("apiSections")
    .withIndex("by_project_position", (q) => q.eq("projectId", projectId))
    .order("desc")
    .first();
  return (last?.position ?? -1) + 1;
}

export async function nextEndpointPosition(
  ctx: DatabaseCtx,
  sectionId: Id<"apiSections">,
) {
  const last = await ctx.db
    .query("apiEndpoints")
    .withIndex("by_section_position", (q) => q.eq("sectionId", sectionId))
    .order("desc")
    .first();
  return (last?.position ?? -1) + 1;
}

export async function nextGuidePagePosition(
  ctx: DatabaseCtx,
  sectionId: Id<"guideSections">,
) {
  const last = await ctx.db
    .query("guidePages")
    .withIndex("by_section_position", (q) => q.eq("sectionId", sectionId))
    .order("desc")
    .first();
  return (last?.position ?? -1) + 1;
}

export async function nextGuideSectionPosition(
  ctx: DatabaseCtx,
  projectId: Id<"apiProjects">,
) {
  const last = await ctx.db
    .query("guideSections")
    .withIndex("by_project_position", (q) => q.eq("projectId", projectId))
    .order("desc")
    .first();
  return (last?.position ?? -1) + 1;
}

export async function getPublicProject(
  ctx: DatabaseCtx,
  organizationSlug: string,
  projectSlug: string,
) {
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
    .unique();

  if (!organization) {
    throw appError(ERROR_CODES.notFound, "Public API project not found");
  }

  const project = await ctx.db
    .query("apiProjects")
    .withIndex("by_organization_slug", (q) =>
      q.eq("organizationId", organization._id).eq("slug", projectSlug),
    )
    .unique();

  if (!project || project.visibility !== "public") {
    throw appError(ERROR_CODES.notFound, "Public API project not found");
  }

  return { organization, project };
}
