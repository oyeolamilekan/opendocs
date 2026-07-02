import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireProjectAccess,
  requireProjectRole,
  requireSectionAccess,
  requireSectionRole,
} from "./lib/authorization";
import {
  emptyEndpointBody,
  getPublicProject,
  nextEndpointPosition,
  uniqueEndpointSlug,
  validateTitle,
} from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  endpointBodyValidator,
  endpointTypeValidator,
  endpointValidator,
  httpMethodValidator,
} from "./lib/validators";

export const create = mutation({
  args: {
    projectId: v.id("apiProjects"),
    sectionId: v.id("apiSections"),
    title: v.string(),
    endpointType: endpointTypeValidator,
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    body: v.optional(endpointBodyValidator),
  },
  returns: v.union(endpointValidator, v.null()),
  handler: async (ctx, args) => {
    const { section } = await requireSectionRole(ctx, args.sectionId, [
      "owner",
      "admin",
    ]);

    if (section.projectId !== args.projectId) {
      throw appError(
        ERROR_CODES.validation,
        "Section does not belong to the selected project",
      );
    }

    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    const title = validateTitle(args.title, "Endpoint");
    const endpointId = await ctx.db.insert("apiEndpoints", {
      projectId: args.projectId,
      versionId: section.versionId,
      sectionId: args.sectionId,
      title,
      slug: await uniqueEndpointSlug(ctx, args.projectId, title),
      endpointType: args.endpointType,
      content: args.content,
      markdown: args.markdown,
      body: args.body ?? emptyEndpointBody,
      position: await nextEndpointPosition(ctx, args.sectionId),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(endpointId);
  },
});

export const get = query({
  args: {
    endpointId: v.id("apiEndpoints"),
  },
  returns: endpointValidator,
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint) {
      throw appError(ERROR_CODES.notFound, "API endpoint not found");
    }
    await requireProjectAccess(ctx, endpoint.projectId);
    return endpoint;
  },
});

export const getBySlug = query({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    slug: v.string(),
  },
  returns: v.union(endpointValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    const endpoint = await findEndpointBySlug(
      ctx,
      args.projectId,
      args.slug,
      args.versionId,
    );

    if (!endpoint) {
      return null;
    }

    return endpoint;
  },
});

export const update = mutation({
  args: {
    endpointId: v.id("apiEndpoints"),
    sectionId: v.optional(v.id("apiSections")),
    title: v.optional(v.string()),
    endpointType: v.optional(endpointTypeValidator),
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    iconName: v.optional(v.string()),
    body: v.optional(endpointBodyValidator),
    position: v.optional(v.number()),
  },
  returns: v.union(endpointValidator, v.null()),
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint) {
      throw appError(ERROR_CODES.notFound, "API endpoint not found");
    }
    await requireProjectRole(ctx, endpoint.projectId, ["owner", "admin"]);

    let sectionId = endpoint.sectionId;
    let sectionChanged = false;
    if (args.sectionId !== undefined) {
      const { section } = await requireSectionAccess(ctx, args.sectionId);
      if (section.projectId !== endpoint.projectId) {
        throw appError(
          ERROR_CODES.validation,
          "Endpoint cannot move to a section in another project",
        );
      }
      sectionId = section._id;
      sectionChanged = sectionId !== endpoint.sectionId;
    }

    const patch: {
      sectionId?: typeof sectionId;
      title?: string;
      slug?: string;
      endpointType?: "endpoint" | "doc";
      content?: string;
      markdown?: string;
      iconName?: string;
      body?: typeof endpoint.body;
      position?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (sectionChanged) {
      patch.sectionId = sectionId;
      if (args.position === undefined) {
        patch.position = await nextEndpointPosition(ctx, sectionId);
      }
    }
    if (args.title !== undefined) {
      const title = validateTitle(args.title, "Endpoint");
      patch.title = title;
      patch.slug = await uniqueEndpointSlug(
        ctx,
        endpoint.projectId,
        title,
        endpoint._id,
      );
    }
    const nextEndpointType = args.endpointType ?? endpoint.endpointType;
    if (args.endpointType !== undefined) {
      patch.endpointType = args.endpointType;
    }
    if (args.content !== undefined) {
      patch.content = args.content;
    }
    if (args.markdown !== undefined) {
      patch.markdown = args.markdown;
    }
    if (nextEndpointType === "endpoint") {
      patch.iconName = undefined;
    } else if (args.iconName !== undefined) {
      const trimmed = args.iconName.trim();
      patch.iconName = trimmed ? trimmed : undefined;
    }
    if (args.body !== undefined) {
      patch.body = args.body;
    }
    if (args.position !== undefined) {
      if (!Number.isInteger(args.position) || args.position < 0) {
        throw appError(
          ERROR_CODES.validation,
          "Endpoint position must be a non-negative integer",
        );
      }
      patch.position = args.position;
    }

    await ctx.db.patch(endpoint._id, patch);
    return await ctx.db.get(endpoint._id);
  },
});

export const remove = mutation({
  args: {
    endpointId: v.id("apiEndpoints"),
  },
  returns: v.object({ deletedEndpointId: v.id("apiEndpoints") }),
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint) {
      throw appError(ERROR_CODES.notFound, "API endpoint not found");
    }
    await requireProjectRole(ctx, endpoint.projectId, ["owner", "admin"]);
    await ctx.db.delete(endpoint._id);
    return { deletedEndpointId: endpoint._id };
  },
});

export const getPublicBySlug = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
    versionSlug: v.optional(v.string()),
    endpointSlug: v.string(),
  },
  returns: v.object({
    title: v.string(),
    slug: v.string(),
    endpointType: endpointTypeValidator,
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    position: v.number(),
    iconName: v.optional(v.string()),
    updatedAt: v.number(),
    body: v.object({
      method: httpMethodValidator,
      path: v.string(),
      description: v.string(),
      parameters: endpointBodyValidator.fields.parameters,
      requestBody: endpointBodyValidator.fields.requestBody,
      authHeader: endpointBodyValidator.fields.authHeader,
      sampleResponses: endpointBodyValidator.fields.sampleResponses,
    }),
  }),
  handler: async (ctx, args) => {
    const { project } = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    const version = await resolvePublicVersion(ctx, project._id, args.versionSlug);
    const endpoint = await findEndpointBySlug(
      ctx,
      project._id,
      args.endpointSlug,
      version?._id,
    );

    if (!endpoint) {
      throw appError(ERROR_CODES.notFound, "Public API endpoint not found");
    }

    return {
      title: endpoint.title,
      slug: endpoint.slug,
      endpointType: endpoint.endpointType,
      content: endpoint.content,
      markdown: endpoint.markdown,
      position: endpoint.position,
      iconName: endpoint.iconName,
      updatedAt: endpoint.updatedAt,
      body: {
        ...endpoint.body,
        authHeader: {
          ...endpoint.body.authHeader,
          value: "",
        },
      },
    };
  },
});

async function findEndpointBySlug(
  ctx: QueryCtx,
  projectId: Id<"apiProjects">,
  slug: string,
  versionId?: Id<"documentationVersions">,
) {
  const version = versionId ? await ctx.db.get(versionId) : null;
  if (versionId) {
    const versionEndpoint = await ctx.db
      .query("apiEndpoints")
      .withIndex("by_version_slug", (q) =>
        q.eq("versionId", versionId).eq("slug", slug),
      )
      .unique();
    if (versionEndpoint) return versionEndpoint;
  }
  if (versionId && !version?.isDefault) return null;
  return await ctx.db
    .query("apiEndpoints")
    .withIndex("by_project_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", slug),
    )
    .collect()
    .then(
      (endpoints) =>
        endpoints.find((endpoint) => endpoint.versionId === undefined) ?? null,
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
