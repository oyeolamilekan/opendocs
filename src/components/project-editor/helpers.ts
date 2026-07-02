import type { Doc } from "../../../convex/_generated/dataModel";
import type {
  EndpointDraft,
  GuidePageDraft,
  GuideNavigation,
  Navigation,
} from "./types";

export function getFirstEndpointSlug(navigation: Navigation) {
  return navigation
    .flatMap((section) => section.endpoints)
    .at(0)?.slug;
}

export function getFirstGuidePageSlug(navigation: GuideNavigation) {
  return navigation
    .flatMap((section) => section.pages)
    .at(0)?.slug;
}

export function selectedDocumentationVersion(
  versions: Doc<"documentationVersions">[] | undefined,
  versionSlug?: string,
) {
  if (!versions?.length) return undefined;
  return (
    (versionSlug
      ? versions.find((version) => version.slug === versionSlug)
      : undefined) ??
    versions.find((version) => version.isDefault) ??
    versions[0]
  );
}

function reorderItems<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return [...items];
  }

  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export function reorderEndpointItems<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
) {
  return reorderItems(items, fromIndex, toIndex);
}

export function reorderSectionItems<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
) {
  return reorderItems(items, fromIndex, toIndex);
}

const STATUS_CODE_OPTIONS = [
  { value: 200, label: "200 OK" },
  { value: 201, label: "201 Created" },
  { value: 202, label: "202 Accepted" },
  { value: 204, label: "204 No Content" },
  { value: 400, label: "400 Bad Request" },
  { value: 401, label: "401 Unauthorized" },
  { value: 403, label: "403 Forbidden" },
  { value: 404, label: "404 Not Found" },
  { value: 409, label: "409 Conflict" },
  { value: 422, label: "422 Unprocessable Content" },
  { value: 429, label: "429 Too Many Requests" },
  { value: 500, label: "500 Internal Server Error" },
  { value: 502, label: "502 Bad Gateway" },
  { value: 503, label: "503 Service Unavailable" },
] as const;

export function optionsWithCurrentValue<T extends { value: string; label: string }>(
  options: readonly T[],
  currentValue: string,
) {
  if (!currentValue || options.some((option) => option.value === currentValue)) {
    return [...options];
  }
  return [{ value: currentValue, label: currentValue }, ...options];
}

export function statusOptionsWithCurrentValue(currentValue: number) {
  if (
    STATUS_CODE_OPTIONS.some((option) => option.value === currentValue) ||
    !Number.isFinite(currentValue)
  ) {
    return [...STATUS_CODE_OPTIONS];
  }
  return [
    { value: currentValue, label: String(currentValue) },
    ...STATUS_CODE_OPTIONS,
  ];
}

export function createEndpointDraft(
  endpoint: Doc<"apiEndpoints">,
): EndpointDraft {
  const content = endpoint.content ?? "";
  const editorType =
    endpoint.endpointType === "doc" && isTipTapContent(content)
      ? "notion"
      : "api";
  return {
    title: endpoint.title,
    sectionId: endpoint.sectionId,
    endpointType: endpoint.endpointType,
    editorType,
    content,
    markdown: endpoint.markdown ?? "",
    body: endpoint.body,
    iconName: endpoint.iconName,
  };
}

export function createGuidePageDraft(
  guidePage: Doc<"guidePages">,
): GuidePageDraft {
  return {
    title: guidePage.title,
    endpointType: "doc",
    editorType: "notion",
    content: guidePage.content ?? EMPTY_DOC_JSON,
    markdown: guidePage.markdown ?? "",
    iconName: guidePage.iconName,
    body: {
      description: guidePage.description,
    },
  };
}

function isTipTapContent(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.type === "doc" &&
      Array.isArray(parsed.content)
    );
  } catch {
    return false;
  }
}

export const EMPTY_DOC_JSON = JSON.stringify({ type: "doc", content: [] });

export function draftForEndpointType(
  draft: EndpointDraft,
  endpointType: EndpointDraft["endpointType"],
): EndpointDraft {
  if (endpointType === "endpoint") {
    return { ...draft, endpointType, editorType: "api", iconName: undefined };
  }

  return {
    ...draft,
    endpointType,
    editorType: "notion",
    content: isTipTapContent(draft.content) ? draft.content : EMPTY_DOC_JSON,
  };
}
