import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  requireMembership,
  requireProjectAccess,
  requireProjectRole,
} from "./lib/authorization";
import { getPublicProject } from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import {
  aiConversationMessageValidator,
  aiConversationSummaryValidator,
  aiConversationValidator,
  aiProviderModeValidator,
  aiProviderValidator,
  aiSettingsValidator,
  documentationVersionValidator,
  endpointBodyValidator,
  endpointTypeValidator,
  httpMethodValidator,
  publicAiSettingsValidator,
  projectValidator,
  projectThemeColorValidator,
  projectVisibilityValidator,
} from "./lib/validators";

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  providerMode: "gateway",
  provider: "vercel",
  model: "anthropic/claude-sonnet-4.5",
  displayName: "AI assistant",
} as const;

const MAX_CONVERSATION_MESSAGES = 60;
const MAX_CONVERSATION_TITLE_LENGTH = 120;
const MAX_MESSAGE_PREVIEW_LENGTH = 220;

async function getSettingsDocument(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"apiProjects">,
) {
  return await ctx.db
    .query("projectAiSettings")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .unique();
}

function sanitizeDisplayName(value: string | undefined) {
  const displayName = (value ?? "").trim();
  return displayName || DEFAULT_AI_SETTINGS.displayName;
}

function sanitizeModel(value: string | undefined) {
  const model = (value ?? "").trim();
  return model || DEFAULT_AI_SETTINGS.model;
}

function toPublicSettings(
  projectId: Id<"apiProjects">,
  settings: Doc<"projectAiSettings"> | null,
) {
  return {
    projectId,
    enabled: settings?.enabled ?? DEFAULT_AI_SETTINGS.enabled,
    providerMode: settings?.providerMode ?? DEFAULT_AI_SETTINGS.providerMode,
    provider: settings?.provider ?? DEFAULT_AI_SETTINGS.provider,
    model: settings?.model ?? DEFAULT_AI_SETTINGS.model,
    displayName: settings?.displayName ?? DEFAULT_AI_SETTINGS.displayName,
    apiKeyConfigured: Boolean(settings?.encryptedApiKey),
    apiKeyHint: settings?.apiKeyHint,
    updatedAt: settings?.updatedAt,
  };
}

function toConversationSummary(conversation: Doc<"projectAiConversations">) {
  const lastMessage = conversation.messages.at(-1);
  return {
    _id: conversation._id,
    _creationTime: conversation._creationTime,
    projectId: conversation.projectId,
    sessionId: conversation.sessionId,
    title: conversation.title,
    providerMode: conversation.providerMode,
    provider: conversation.provider,
    model: conversation.model,
    messageCount: conversation.messageCount ?? conversation.messages.length,
    lastMessagePreview:
      conversation.lastMessagePreview ??
      (lastMessage ? truncate(lastMessage.content, MAX_MESSAGE_PREVIEW_LENGTH) : ""),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export const getProjectContext = query({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: v.object({
    project: v.object({
      title: v.string(),
      slug: v.string(),
      baseUrl: v.string(),
      description: v.string(),
      visibility: projectVisibilityValidator,
      themeColor: v.optional(projectThemeColorValidator),
      updatedAt: v.number(),
    }),
    apiSections: v.array(
      v.object({
        title: v.string(),
        slug: v.string(),
        position: v.number(),
        endpoints: v.array(
          v.object({
            title: v.string(),
            slug: v.string(),
            endpointType: endpointTypeValidator,
            content: v.optional(v.string()),
            markdown: v.optional(v.string()),
            position: v.number(),
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
        ),
      }),
    ),
    guideSections: v.array(
      v.object({
        title: v.string(),
        slug: v.string(),
        position: v.number(),
        pages: v.array(
          v.object({
            title: v.string(),
            slug: v.string(),
            content: v.optional(v.string()),
            markdown: v.optional(v.string()),
            description: v.string(),
            position: v.number(),
            updatedAt: v.number(),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { project } = await requireProjectAccess(ctx, args.projectId);
    const [apiSections, guideSections] = await Promise.all([
      ctx.db
        .query("apiSections")
        .withIndex("by_project_position", (q) =>
          q.eq("projectId", project._id),
        )
        .order("asc")
        .collect(),
      ctx.db
        .query("guideSections")
        .withIndex("by_project_position", (q) =>
          q.eq("projectId", project._id),
        )
        .order("asc")
        .collect(),
    ]);

    const [apiSectionsWithEndpoints, guideSectionsWithPages] =
      await Promise.all([
        Promise.all(
          apiSections.map(async (section) => ({
            title: section.title,
            slug: section.slug,
            position: section.position,
            endpoints: await ctx.db
              .query("apiEndpoints")
              .withIndex("by_section_position", (q) =>
                q.eq("sectionId", section._id),
              )
              .order("asc")
              .collect()
              .then((endpoints) =>
                endpoints.map((endpoint) => ({
                  title: endpoint.title,
                  slug: endpoint.slug,
                  endpointType: endpoint.endpointType,
                  content: endpoint.content,
                  markdown: endpoint.markdown,
                  position: endpoint.position,
                  updatedAt: endpoint.updatedAt,
                  body: {
                    ...endpoint.body,
                    authHeader: {
                      ...endpoint.body.authHeader,
                      value: "",
                    },
                  },
                })),
              ),
          })),
        ),
        Promise.all(
          guideSections.map(async (section) => ({
            title: section.title,
            slug: section.slug,
            position: section.position,
            pages: await ctx.db
              .query("guidePages")
              .withIndex("by_section_position", (q) =>
                q.eq("sectionId", section._id),
              )
              .order("asc")
              .collect()
              .then((pages) =>
                pages.map((page) => ({
                  title: page.title,
                  slug: page.slug,
                  content: page.content,
                  markdown: page.markdown,
                  description: page.description,
                  position: page.position,
                  updatedAt: page.updatedAt,
                })),
              ),
          })),
        ),
      ]);

    return {
      project: {
        title: project.title,
        slug: project.slug,
        baseUrl: project.baseUrl,
        description: project.description,
        visibility: project.visibility,
        themeColor: project.themeColor,
        updatedAt: project.updatedAt,
      },
      apiSections: apiSectionsWithEndpoints,
      guideSections: guideSectionsWithPages,
    };
  },
});

export const getPublicProjectContextBySlug = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.union(
    v.object({
      project: v.object({
        _id: v.id("apiProjects"),
        title: v.string(),
        slug: v.string(),
        baseUrl: v.string(),
        description: v.string(),
        visibility: projectVisibilityValidator,
        themeColor: v.optional(projectThemeColorValidator),
        updatedAt: v.number(),
      }),
      apiSections: v.array(
        v.object({
          title: v.string(),
          slug: v.string(),
          position: v.number(),
          endpoints: v.array(
            v.object({
              title: v.string(),
              slug: v.string(),
              endpointType: endpointTypeValidator,
              content: v.optional(v.string()),
              markdown: v.optional(v.string()),
              position: v.number(),
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
          ),
        }),
      ),
      guideSections: v.array(
        v.object({
          title: v.string(),
          slug: v.string(),
          position: v.number(),
          pages: v.array(
            v.object({
              title: v.string(),
              slug: v.string(),
              content: v.optional(v.string()),
              markdown: v.optional(v.string()),
              description: v.string(),
              position: v.number(),
              updatedAt: v.number(),
            }),
          ),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const result = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    if (!result) return null;
    const project = result.project;
    const [apiSections, guideSections] = await Promise.all([
      ctx.db
        .query("apiSections")
        .withIndex("by_project_position", (q) =>
          q.eq("projectId", project._id),
        )
        .order("asc")
        .collect(),
      ctx.db
        .query("guideSections")
        .withIndex("by_project_position", (q) =>
          q.eq("projectId", project._id),
        )
        .order("asc")
        .collect(),
    ]);

    const [apiSectionsWithEndpoints, guideSectionsWithPages] =
      await Promise.all([
        Promise.all(
          apiSections.map(async (section) => ({
            title: section.title,
            slug: section.slug,
            position: section.position,
            endpoints: await ctx.db
              .query("apiEndpoints")
              .withIndex("by_section_position", (q) =>
                q.eq("sectionId", section._id),
              )
              .order("asc")
              .collect()
              .then((endpoints) =>
                endpoints.map((endpoint) => ({
                  title: endpoint.title,
                  slug: endpoint.slug,
                  endpointType: endpoint.endpointType,
                  content: endpoint.content,
                  markdown: endpoint.markdown,
                  position: endpoint.position,
                  updatedAt: endpoint.updatedAt,
                  body: {
                    ...endpoint.body,
                    authHeader: {
                      ...endpoint.body.authHeader,
                      value: "",
                    },
                  },
                })),
              ),
          })),
        ),
        Promise.all(
          guideSections.map(async (section) => ({
            title: section.title,
            slug: section.slug,
            position: section.position,
            pages: await ctx.db
              .query("guidePages")
              .withIndex("by_section_position", (q) =>
                q.eq("sectionId", section._id),
              )
              .order("asc")
              .collect()
              .then((pages) =>
                pages.map((page) => ({
                  title: page.title,
                  slug: page.slug,
                  content: page.content,
                  markdown: page.markdown,
                  description: page.description,
                  position: page.position,
                  updatedAt: page.updatedAt,
                })),
              ),
          })),
        ),
      ]);

    return {
      project: {
        _id: project._id,
        title: project.title,
        slug: project.slug,
        baseUrl: project.baseUrl,
        description: project.description,
        visibility: project.visibility,
        themeColor: project.themeColor,
        updatedAt: project.updatedAt,
      },
      apiSections: apiSectionsWithEndpoints,
      guideSections: guideSectionsWithPages,
    };
  },
});

export const getSettings = query({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: publicAiSettingsValidator,
  handler: async (ctx, args) => {
    const { project } = await requireProjectAccess(ctx, args.projectId);
    const settings = await getSettingsDocument(ctx, project._id);
    return toPublicSettings(project._id, settings);
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
      settings: publicAiSettingsValidator,
      versions: v.array(documentationVersionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("apiProjects")
      .withIndex("by_organization_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", args.slug),
      )
      .unique();

    if (!project) return null;
    await requireMembership(ctx, project.organizationId);

    const [settings, versions] = await Promise.all([
      getSettingsDocument(ctx, project._id),
      ctx.db
        .query("documentationVersions")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .order("desc")
        .collect(),
    ]);

    return {
      project,
      settings: toPublicSettings(project._id, settings),
      versions,
    };
  },
});

export const getRuntimeSettings = query({
  args: {
    projectId: v.id("apiProjects"),
  },
  returns: v.object({
    settings: v.union(aiSettingsValidator, v.null()),
    publicSettings: publicAiSettingsValidator,
  }),
  handler: async (ctx, args) => {
    const { project } = await requireProjectAccess(ctx, args.projectId);
    const settings = await getSettingsDocument(ctx, project._id);
    return {
      settings,
      publicSettings: toPublicSettings(project._id, settings),
    };
  },
});

export const getPublicSettingsBySlug = query({
  args: {
    organizationSlug: v.string(),
    projectSlug: v.string(),
  },
  returns: v.union(publicAiSettingsValidator, v.null()),
  handler: async (ctx, args) => {
    const result = await getPublicProject(
      ctx,
      args.organizationSlug,
      args.projectSlug,
    );
    if (!result) return null;
    const settings = await getSettingsDocument(ctx, result.project._id);
    return toPublicSettings(result.project._id, settings);
  },
});

export const updateSettings = mutation({
  args: {
    projectId: v.id("apiProjects"),
    enabled: v.boolean(),
    providerMode: aiProviderModeValidator,
    provider: aiProviderValidator,
    model: v.string(),
    displayName: v.string(),
    encryptedApiKey: v.optional(v.string()),
    apiKeyHint: v.optional(v.string()),
    clearApiKey: v.optional(v.boolean()),
  },
  returns: publicAiSettingsValidator,
  handler: async (ctx, args) => {
    const { project } = await requireProjectRole(ctx, args.projectId, [
      "owner",
      "admin",
    ]);
    const existing = await getSettingsDocument(ctx, project._id);
    const now = Date.now();
    const next = {
      projectId: project._id,
      enabled: args.enabled,
      providerMode: args.providerMode,
      provider: args.provider,
      model: sanitizeModel(args.model),
      displayName: sanitizeDisplayName(args.displayName),
      encryptedApiKey: args.clearApiKey
        ? undefined
        : (args.encryptedApiKey ?? existing?.encryptedApiKey),
      apiKeyHint: args.clearApiKey
        ? undefined
        : (args.apiKeyHint ?? existing?.apiKeyHint),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: next.enabled,
        providerMode: next.providerMode,
        provider: next.provider,
        model: next.model,
        displayName: next.displayName,
        encryptedApiKey: next.encryptedApiKey,
        apiKeyHint: next.apiKeyHint,
        updatedAt: next.updatedAt,
      });
    } else {
      await ctx.db.insert("projectAiSettings", next);
    }

    return {
      projectId: project._id,
      enabled: next.enabled,
      providerMode: next.providerMode,
      provider: next.provider,
      model: next.model,
      displayName: next.displayName,
      apiKeyConfigured: Boolean(next.encryptedApiKey),
      apiKeyHint: next.apiKeyHint,
      updatedAt: next.updatedAt,
    };
  },
});

export const listConversations = query({
  args: {
    projectId: v.id("apiProjects"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(aiConversationValidator),
  handler: async (ctx, args) => {
    const { project } = await requireProjectAccess(ctx, args.projectId);
    return await ctx.db
      .query("projectAiConversations")
      .withIndex("by_project_updated", (q) => q.eq("projectId", project._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listConversationSummaries = query({
  args: {
    projectId: v.id("apiProjects"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(aiConversationSummaryValidator),
  handler: async (ctx, args) => {
    const { project } = await requireProjectAccess(ctx, args.projectId);
    const result = await ctx.db
      .query("projectAiConversations")
      .withIndex("by_project_updated", (q) => q.eq("projectId", project._id))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map(toConversationSummary),
    };
  },
});

export const getConversation = query({
  args: {
    conversationId: v.id("projectAiConversations"),
  },
  returns: v.union(aiConversationValidator, v.null()),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    await requireProjectAccess(ctx, conversation.projectId);
    return conversation;
  },
});

export const recordPublicConversation = mutation({
  args: {
    projectId: v.id("apiProjects"),
    sessionId: v.string(),
    providerMode: aiProviderModeValidator,
    provider: aiProviderValidator,
    model: v.string(),
    messages: v.array(aiConversationMessageValidator),
  },
  returns: v.id("projectAiConversations"),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.visibility !== "public") {
      throw appError(ERROR_CODES.notFound, "Public project not found");
    }

    const now = Date.now();
    const safeMessages = args.messages
      .filter((message) => message.content.trim())
      .slice(-MAX_CONVERSATION_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
        createdAt: message.createdAt || now,
      }));

    const existing = await ctx.db
      .query("projectAiConversations")
      .withIndex("by_project_session", (q) =>
        q.eq("projectId", args.projectId).eq("sessionId", args.sessionId),
      )
      .unique();

    const firstUserMessage = safeMessages.find(
      (message) => message.role === "user",
    );
    const title =
      firstUserMessage?.content
        .slice(0, MAX_CONVERSATION_TITLE_LENGTH)
        .trim() || "Untitled conversation";
    const lastMessagePreview = truncate(
      safeMessages.at(-1)?.content ?? "",
      MAX_MESSAGE_PREVIEW_LENGTH,
    );
    const messageCount = safeMessages.length;

    if (existing) {
      await ctx.db.patch(existing._id, {
        title,
        providerMode: args.providerMode,
        provider: args.provider,
        model: sanitizeModel(args.model),
        messages: safeMessages,
        messageCount,
        lastMessagePreview,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("projectAiConversations", {
      projectId: args.projectId,
      sessionId: args.sessionId,
      title,
      providerMode: args.providerMode,
      provider: args.provider,
      model: sanitizeModel(args.model),
      messages: safeMessages,
      messageCount,
      lastMessagePreview,
      createdAt: now,
      updatedAt: now,
    });
  },
});

function truncate(value: string, maxLength: number) {
  const text = value.trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}
