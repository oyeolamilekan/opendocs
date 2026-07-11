import type { useRouter } from "@tanstack/react-router";

export type PublicData =
  | Awaited<ReturnType<typeof import("../../lib/public-docs").loadPublicEndpoint>>
  | Awaited<ReturnType<typeof import("../../lib/public-docs").loadPublicGuidePage>>;

export type FieldItem = {
  name: string;
  dataType: string;
  required: boolean;
  description: string;
  location?: string;
  fields?: FieldItem[];
};

export type DocumentationSearchScope = "all" | "guides" | "reference";

export type DocumentationSearchResult = {
  id: string;
  kind: "guide" | "reference";
  title: string;
  description: string;
  sectionTitle: string;
  href: string;
  iconName?: string;
  endpointType?: "endpoint" | "doc";
  method?: string;
  path?: string;
};

export type IndexedDocumentationSearchResult = DocumentationSearchResult & {
  searchHaystack: string;
};

export type PublicDocumentationRouter = ReturnType<typeof useRouter>;
