import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

export type EndpointBody = Doc<"apiEndpoints">["body"];
export type VersionFlag = "isDefault" | "isBeta" | "isDeprecated";
export type EndpointDraft = {
  title: string;
  sectionId: Id<"apiSections">;
  endpointType: "endpoint" | "doc";
  editorType: "api" | "notion";
  content: string;
  markdown: string;
  body: EndpointBody;
  iconName?: string;
};
export type GuidePageDraft = {
  title: string;
  endpointType: "doc";
  editorType: "notion";
  content: string;
  markdown: string;
  iconName?: string;
  body: {
    description: string;
  };
};
export type Endpoint = Doc<"apiEndpoints"> | null | undefined;
export type GuidePage = Doc<"guidePages"> | null | undefined;
export type Navigation = NonNullable<
  ReturnType<typeof useQuery<typeof api.sections.navigation>>
>;
export type GuideNavigation = NonNullable<
  ReturnType<typeof useQuery<typeof api.guides.navigation>>
>;
export type SectionItem = Navigation[number];
export type EndpointItem = Navigation[number]["endpoints"][number];
export type GuideSectionItem = GuideNavigation[number];
export type GuidePageItem = GuideNavigation[number]["pages"][number];

export const PROJECT_DOCUMENTATION_AREAS = [
  { id: "guides", label: "Guides", status: "active" },
  { id: "api-reference", label: "API Reference", status: "active" },
  { id: "navigation", label: "Navigation", status: "active" },
  { id: "metrics", label: "Metrics", status: "active" },
  { id: "ai", label: "AI", status: "active" },
  { id: "version-settings", label: "Version Settings", status: "active" },
  { id: "settings", label: "Settings", status: "active" },
] as const;
export type ProjectDocumentationArea =
  (typeof PROJECT_DOCUMENTATION_AREAS)[number]["id"];
export type EditableProjectDocumentationArea = Exclude<
  ProjectDocumentationArea,
  "navigation" | "metrics" | "ai" | "version-settings" | "settings"
>;
