import { v, type Validator } from "convex/values";

export const organizationRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

export const membershipStatusValidator = v.union(
  v.literal("active"),
  v.literal("invited"),
  v.literal("disabled"),
);

export const projectVisibilityValidator = v.union(
  v.literal("private"),
  v.literal("public"),
);

export const documentationVersionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
);

export const DEFAULT_PROJECT_THEME_COLOR = "emerald" as const;

export const projectThemeColorValidator = v.union(
  v.literal("emerald"),
  v.literal("blue"),
  v.literal("violet"),
  v.literal("rose"),
  v.literal("orange"),
  v.literal("slate"),
);

export const projectDocumentationStyleValidator = v.union(
  v.literal("default"),
  v.literal("compact"),
  v.literal("editorial"),
);

export const projectDocumentationFontValidator = v.union(
  v.literal("sans"),
  v.literal("serif"),
  v.literal("mono"),
  v.literal("inter"),
  v.literal("roboto"),
  v.literal("open-sans"),
  v.literal("lato"),
  v.literal("ibm-plex-sans"),
  v.literal("merriweather"),
  v.literal("source-serif-4"),
  v.literal("jetbrains-mono"),
);

export type DocumentationFont =
  | "sans"
  | "serif"
  | "mono"
  | "inter"
  | "roboto"
  | "open-sans"
  | "lato"
  | "ibm-plex-sans"
  | "merriweather"
  | "source-serif-4"
  | "jetbrains-mono";

export const aiProviderModeValidator = v.union(
  v.literal("gateway"),
  v.literal("ai-sdk"),
  v.literal("native"),
);

export const aiProviderValidator = v.union(
  v.literal("vercel"),
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("google"),
  v.literal("xai"),
  v.literal("groq"),
  v.literal("mistral"),
  v.literal("custom"),
);

export const aiConversationRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
);

export const aiConversationMessageValidator = v.object({
  role: aiConversationRoleValidator,
  content: v.string(),
  createdAt: v.number(),
});

export const endpointTypeValidator = v.union(
  v.literal("endpoint"),
  v.literal("doc"),
);

export const httpMethodValidator = v.union(
  v.literal("GET"),
  v.literal("POST"),
  v.literal("PUT"),
  v.literal("PATCH"),
  v.literal("DELETE"),
  v.literal("OPTIONS"),
  v.literal("HEAD"),
);

export const endpointParameterValidator = v.object({
  name: v.string(),
  location: v.string(),
  required: v.boolean(),
  description: v.string(),
  dataType: v.string(),
});

export type EndpointRequestBodyField = {
  name: string;
  dataType: string;
  required: boolean;
  description: string;
  fields?: EndpointRequestBodyField[];
};

function requestBodyFieldValidator(
  depth: number,
): Validator<EndpointRequestBodyField> {
  if (depth === 0) {
    return v.object({
      name: v.string(),
      dataType: v.string(),
      required: v.boolean(),
      description: v.string(),
    }) as unknown as Validator<EndpointRequestBodyField>;
  }

  return v.object({
    name: v.string(),
    dataType: v.string(),
    required: v.boolean(),
    description: v.string(),
    fields: v.optional(v.array(requestBodyFieldValidator(depth - 1))),
  }) as unknown as Validator<EndpointRequestBodyField>;
}

export const endpointRequestBodyFieldValidator =
  requestBodyFieldValidator(5);

export const endpointAuthHeaderValidator = v.object({
  type: v.union(
    v.literal("none"),
    v.literal("bearer"),
    v.literal("apiKey"),
    v.literal("basic"),
  ),
  key: v.string(),
  value: v.string(),
});

export const endpointSampleResponseValidator = v.object({
  statusCode: v.number(),
  description: v.string(),
  body: v.string(),
});

export const endpointBodyValidator = v.object({
  method: httpMethodValidator,
  path: v.string(),
  description: v.string(),
  parameters: v.array(endpointParameterValidator),
  requestBody: v.array(endpointRequestBodyFieldValidator),
  authHeader: endpointAuthHeaderValidator,
  sampleResponses: v.array(endpointSampleResponseValidator),
});

export const importedEndpointValidator = v.object({
  title: v.string(),
  content: v.optional(v.string()),
  markdown: v.optional(v.string()),
  body: endpointBodyValidator,
});

export const importedSectionValidator = v.object({
  title: v.string(),
  endpoints: v.array(importedEndpointValidator),
});

export const userProfileValidator = v.object({
  _id: v.id("userProfiles"),
  _creationTime: v.number(),
  authUserId: v.string(),
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  legacyPublicId: v.optional(v.string()),
  updatedAt: v.number(),
});

export const organizationValidator = v.object({
  _id: v.id("organizations"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  legacyPublicId: v.optional(v.string()),
  createdBy: v.id("userProfiles"),
  updatedAt: v.number(),
});

export const organizationMembershipValidator = v.object({
  _id: v.id("organizationMembers"),
  _creationTime: v.number(),
  organizationId: v.id("organizations"),
  userProfileId: v.id("userProfiles"),
  role: organizationRoleValidator,
  status: membershipStatusValidator,
  updatedAt: v.number(),
});

export const organizationInvitationValidator = v.object({
  _id: v.id("organizationInvitations"),
  _creationTime: v.number(),
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
});

export const projectValidator = v.object({
  _id: v.id("apiProjects"),
  _creationTime: v.number(),
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
});

export const documentationVersionValidator = v.object({
  _id: v.id("documentationVersions"),
  _creationTime: v.number(),
  projectId: v.id("apiProjects"),
  name: v.string(),
  slug: v.string(),
  status: documentationVersionStatusValidator,
  isDefault: v.boolean(),
  isBeta: v.optional(v.boolean()),
  isDeprecated: v.optional(v.boolean()),
  createdFromVersionId: v.optional(v.id("documentationVersions")),
  updatedAt: v.number(),
});

export const documentationNavigationItemValidator = v.object({
  _id: v.id("documentationNavigationItems"),
  _creationTime: v.number(),
  projectId: v.id("apiProjects"),
  versionId: v.id("documentationVersions"),
  label: v.string(),
  href: v.string(),
  position: v.number(),
  isVisible: v.boolean(),
  openInNewTab: v.boolean(),
  updatedAt: v.number(),
});

export const aiSettingsValidator = v.object({
  _id: v.id("projectAiSettings"),
  _creationTime: v.number(),
  projectId: v.id("apiProjects"),
  enabled: v.boolean(),
  providerMode: aiProviderModeValidator,
  provider: aiProviderValidator,
  model: v.string(),
  displayName: v.string(),
  encryptedApiKey: v.optional(v.string()),
  apiKeyHint: v.optional(v.string()),
  updatedAt: v.number(),
});

export const publicAiSettingsValidator = v.object({
  projectId: v.id("apiProjects"),
  enabled: v.boolean(),
  providerMode: aiProviderModeValidator,
  provider: aiProviderValidator,
  model: v.string(),
  displayName: v.string(),
  apiKeyConfigured: v.boolean(),
  apiKeyHint: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
});

export const aiConversationValidator = v.object({
  _id: v.id("projectAiConversations"),
  _creationTime: v.number(),
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
});

export const aiConversationSummaryValidator = v.object({
  _id: v.id("projectAiConversations"),
  _creationTime: v.number(),
  projectId: v.id("apiProjects"),
  sessionId: v.string(),
  title: v.string(),
  providerMode: aiProviderModeValidator,
  provider: aiProviderValidator,
  model: v.string(),
  messageCount: v.number(),
  lastMessagePreview: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const sectionValidator = v.object({
  _id: v.id("apiSections"),
  _creationTime: v.number(),
  projectId: v.id("apiProjects"),
  versionId: v.optional(v.id("documentationVersions")),
  title: v.string(),
  slug: v.string(),
  position: v.number(),
  legacyPublicId: v.optional(v.string()),
  updatedAt: v.number(),
});

export const endpointValidator = v.object({
  _id: v.id("apiEndpoints"),
  _creationTime: v.number(),
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
});

export const guidePageValidator = v.object({
  _id: v.id("guidePages"),
  _creationTime: v.number(),
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
});

export const guideSectionValidator = v.object({
  _id: v.id("guideSections"),
  _creationTime: v.number(),
  projectId: v.id("apiProjects"),
  versionId: v.optional(v.id("documentationVersions")),
  title: v.string(),
  slug: v.string(),
  position: v.number(),
  updatedAt: v.number(),
});

export const documentationIconNameValidator = v.optional(v.string());

export const navigationGuidePageValidator = v.object({
  _id: v.id("guidePages"),
  title: v.string(),
  slug: v.string(),
  description: v.string(),
  position: v.number(),
  iconName: documentationIconNameValidator,
});

export const navigationGuideSectionValidator = v.object({
  ...guideSectionValidator.fields,
  pages: v.array(navigationGuidePageValidator),
});

export const navigationEndpointValidator = v.object({
  _id: v.id("apiEndpoints"),
  title: v.string(),
  slug: v.string(),
  endpointType: endpointTypeValidator,
  method: httpMethodValidator,
  path: v.string(),
  description: v.string(),
  position: v.number(),
  iconName: documentationIconNameValidator,
});

export const navigationSectionValidator = v.object({
  ...sectionValidator.fields,
  endpoints: v.array(navigationEndpointValidator),
});

export type OrganizationRole = "owner" | "admin" | "member";
export type MembershipStatus = "active" | "invited" | "disabled";
