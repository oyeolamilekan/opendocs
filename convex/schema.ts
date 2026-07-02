import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { rateLimitTables } from "convex-helpers/server/rateLimit";
import {
  endpointBodyValidator,
  endpointTypeValidator,
  aiConversationMessageValidator,
  aiProviderModeValidator,
  aiProviderValidator,
  documentationVersionStatusValidator,
  membershipStatusValidator,
  projectDocumentationFontValidator,
  projectDocumentationStyleValidator,
  organizationRoleValidator,
  projectThemeColorValidator,
  projectVisibilityValidator,
} from "./lib/validators";

export default defineSchema({
  ...rateLimitTables,

  waitlistEntries: defineTable({
    email: v.string(),
    source: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("invited"),
      v.literal("converted"),
    ),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  userProfiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    legacyPublicId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_legacy_public_id", ["legacyPublicId"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    legacyPublicId: v.optional(v.string()),
    createdBy: v.id("userProfiles"),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_legacy_public_id", ["legacyPublicId"]),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userProfileId: v.id("userProfiles"),
    role: organizationRoleValidator,
    status: membershipStatusValidator,
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userProfileId"])
    .index("by_user_status", ["userProfileId", "status"])
    .index("by_organization_user", ["organizationId", "userProfileId"]),

  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: organizationRoleValidator,
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
    ),
    invitedBy: v.id("userProfiles"),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_email_status", ["email", "status"])
    .index("by_organization_email", ["organizationId", "email"]),

  apiProjects: defineTable({
    organizationId: v.id("organizations"),
    title: v.string(),
    slug: v.string(),
    baseUrl: v.string(),
    description: v.string(),
    visibility: projectVisibilityValidator,
    themeColor: v.optional(projectThemeColorValidator),
    brandColor: v.optional(v.string()),
    documentationStyle: v.optional(projectDocumentationStyleValidator),
    documentationFont: v.optional(projectDocumentationFontValidator),
    logoStorageId: v.optional(v.id("_storage")),
    darkLogoStorageId: v.optional(v.id("_storage")),
    faviconStorageId: v.optional(v.id("_storage")),
    legacyPublicId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_slug", ["slug"])
    .index("by_organization_slug", ["organizationId", "slug"])
    .index("by_legacy_public_id", ["legacyPublicId"]),

  documentationVersions: defineTable({
    projectId: v.id("apiProjects"),
    name: v.string(),
    slug: v.string(),
    status: documentationVersionStatusValidator,
    isDefault: v.boolean(),
    isBeta: v.optional(v.boolean()),
    isDeprecated: v.optional(v.boolean()),
    createdFromVersionId: v.optional(v.id("documentationVersions")),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_slug", ["projectId", "slug"])
    .index("by_project_default", ["projectId", "isDefault"]),

  documentationNavigationItems: defineTable({
    projectId: v.id("apiProjects"),
    versionId: v.id("documentationVersions"),
    label: v.string(),
    href: v.string(),
    position: v.number(),
    isVisible: v.boolean(),
    openInNewTab: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_version", ["versionId"])
    .index("by_version_position", ["versionId", "position"]),

  projectAiSettings: defineTable({
    projectId: v.id("apiProjects"),
    enabled: v.boolean(),
    providerMode: aiProviderModeValidator,
    provider: aiProviderValidator,
    model: v.string(),
    displayName: v.string(),
    encryptedApiKey: v.optional(v.string()),
    apiKeyHint: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  projectAiConversations: defineTable({
    projectId: v.id("apiProjects"),
    sessionId: v.string(),
    title: v.string(),
    providerMode: aiProviderModeValidator,
    provider: aiProviderValidator,
    model: v.string(),
    messages: v.array(aiConversationMessageValidator),
    messageCount: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_updated", ["projectId", "updatedAt"])
    .index("by_project_session", ["projectId", "sessionId"]),

  apiSections: defineTable({
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    title: v.string(),
    slug: v.string(),
    position: v.number(),
    legacyPublicId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_version", ["versionId"])
    .index("by_version_slug", ["versionId", "slug"])
    .index("by_version_position", ["versionId", "position"])
    .index("by_project_slug", ["projectId", "slug"])
    .index("by_project_position", ["projectId", "position"])
    .index("by_legacy_public_id", ["legacyPublicId"]),

  apiEndpoints: defineTable({
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    sectionId: v.id("apiSections"),
    title: v.string(),
    slug: v.string(),
    endpointType: endpointTypeValidator,
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    body: endpointBodyValidator,
    position: v.number(),
    iconName: v.optional(v.string()),
    legacyPublicId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_version", ["versionId"])
    .index("by_version_slug", ["versionId", "slug"])
    .index("by_section", ["sectionId"])
    .index("by_project_slug", ["projectId", "slug"])
    .index("by_section_position", ["sectionId", "position"])
    .index("by_legacy_public_id", ["legacyPublicId"]),

  guideSections: defineTable({
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    title: v.string(),
    slug: v.string(),
    position: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_version", ["versionId"])
    .index("by_version_slug", ["versionId", "slug"])
    .index("by_version_position", ["versionId", "position"])
    .index("by_project_slug", ["projectId", "slug"])
    .index("by_project_position", ["projectId", "position"]),

  guidePages: defineTable({
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    sectionId: v.optional(v.id("guideSections")),
    title: v.string(),
    slug: v.string(),
    content: v.optional(v.string()),
    markdown: v.optional(v.string()),
    description: v.string(),
    position: v.number(),
    iconName: v.optional(v.string()),
    legacyPublicId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_version", ["versionId"])
    .index("by_version_slug", ["versionId", "slug"])
    .index("by_section", ["sectionId"])
    .index("by_project_slug", ["projectId", "slug"])
    .index("by_project_position", ["projectId", "position"])
    .index("by_section_position", ["sectionId", "position"])
    .index("by_legacy_public_id", ["legacyPublicId"]),

  documentationImages: defineTable({
    projectId: v.id("apiProjects"),
    storageId: v.id("_storage"),
    uploadedBy: v.id("userProfiles"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_storage_id", ["storageId"]),

  analyticsEvents: defineTable({
    projectId: v.id("apiProjects"),
    eventType: v.union(v.literal("api_call"), v.literal("page_view")),
    createdAt: v.number(),
    bucketHourStart: v.number(),
    bucketDayStart: v.number(),
    versionSlug: v.optional(v.string()),
    method: v.optional(v.string()),
    status: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    endpointSlug: v.optional(v.string()),
    endpointTitle: v.optional(v.string()),
    endpointPath: v.optional(v.string()),
    pageType: v.optional(v.union(v.literal("guide"), v.literal("reference"))),
    pageSlug: v.optional(v.string()),
    pageTitle: v.optional(v.string()),
    pagePath: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_project_created", ["projectId", "createdAt"])
    .index("by_project_type_created", ["projectId", "eventType", "createdAt"]),

  analyticsCounters: defineTable({
    projectId: v.id("apiProjects"),
    eventType: v.union(v.literal("api_call"), v.literal("page_view")),
    bucketSize: v.union(v.literal("hour"), v.literal("day")),
    bucketStart: v.number(),
    dimensionKey: v.string(),
    dimensionLabel: v.string(),
    dimensionSlug: v.optional(v.string()),
    dimensionPath: v.optional(v.string()),
    method: v.optional(v.string()),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project_counter", [
      "projectId",
      "eventType",
      "bucketSize",
      "bucketStart",
      "dimensionKey",
    ])
    .index("by_project_event_bucket", [
      "projectId",
      "eventType",
      "bucketSize",
      "bucketStart",
    ]),
});
