import type {
  DocumentationSearchResult,
  IndexedDocumentationSearchResult,
} from "./types";

export function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function getOptionalDescription(value: {
  description?: string | null;
}) {
  return typeof value.description === "string" ? value.description : "";
}

export function getDocumentationSearchHaystack(
  result: DocumentationSearchResult,
) {
  return normalizeSearchText(
    [
      result.title,
      result.description,
      result.sectionTitle,
      result.method,
      result.path,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function filterDocumentationSearchResults(
  index: IndexedDocumentationSearchResult[],
  query: string,
  scope: "all" | "guides" | "reference",
) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return index.filter((result) => {
    const matchesScope =
      scope === "all" ||
      (scope === "guides" && result.kind === "guide") ||
      (scope === "reference" && result.kind === "reference");

    return matchesScope && result.searchHaystack.includes(normalizedQuery);
  });
}

export function getDocumentationSearchSnippet(
  result: DocumentationSearchResult,
  normalizedQuery: string,
) {
  const candidates = [
    result.description,
    result.path,
    result.sectionTitle,
    result.title,
  ].filter((candidate): candidate is string => Boolean(candidate));

  return (
    candidates.find((candidate) =>
      normalizeSearchText(candidate).includes(normalizedQuery),
    ) ??
    candidates[0] ??
    result.title
  );
}
