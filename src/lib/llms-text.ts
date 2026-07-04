import type { ExportGuidePage } from "./markdown-export";
import type {
  OpenApiExportProject,
  OpenApiExportSection,
} from "./openapi-export";

export type LlmsGuideSection = {
  title: string;
  slug: string;
  position: number;
  pages: ExportGuidePage[];
};

/**
 * Formats project documentation into an llms.txt index.
 *
 * @param options - Function options.
 * @param options.project - Project metadata used by the operation.
 * @param options.guides - Published guide sections to include.
 * @param options.sections - Published API reference sections to include.
 * @param options.publicBaseUrl - Absolute public documentation base URL used for links.
 * @returns Result produced by the function.
 */
export const formatLlmsTxt = ({
  project,
  guides,
  sections,
  publicBaseUrl,
}: {
  project: OpenApiExportProject;
  guides: LlmsGuideSection[];
  sections: OpenApiExportSection[];
  publicBaseUrl: string;
}) => {
  const baseUrl = publicBaseUrl.replace(/\/$/, "");
  const lines = [
    `# ${project.project.title}`,
    "",
    `> ${project.project.description}`,
    "",
    `Organization: ${project.organization.name}`,
    `API base URL: ${project.project.baseUrl}`,
    "",
    "## Guides",
    "",
    guideLines(guides, baseUrl),
    "",
    "## API Reference",
    "",
    endpointLines(sections, baseUrl),
    "",
    "## Machine-readable API schema",
    "",
    `OpenAPI JSON: ${baseUrl}/openapi.json`,
  ];

  return `${lines
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
};

/**
 * Builds llms.txt link lines for guide pages.
 *
 * @param guides - Guide sections to format.
 * @param baseUrl - Base URL used to build links.
 * @returns llms.txt guide lines.
 */
const guideLines = (guides: LlmsGuideSection[], baseUrl: string) => {
  const lines = guides.flatMap((section) => [
    `### ${section.title}`,
    "",
    ...section.pages.map(
      (page) =>
        `- ${page.title}${page.description ? ` — ${page.description}` : ""}\n  ${baseUrl}/guides/${page.slug}.md`,
    ),
    "",
  ]);

  return lines.length ? lines.join("\n") : "No guide pages are published.";
};

/**
 * Builds llms.txt link lines for endpoint pages.
 *
 * @param sections - API sections to inspect.
 * @param baseUrl - Base URL used to build links.
 * @returns llms.txt endpoint lines.
 */
const endpointLines = (sections: OpenApiExportSection[], baseUrl: string) => {
  const lines = sections.flatMap((section) => [
    `### ${section.title}`,
    "",
    ...section.endpoints.map((endpoint) => {
      if (endpoint.endpointType === "doc") {
        return `- ${endpoint.title}\n  ${baseUrl}/reference/${endpoint.slug}.md`;
      }

      return `- ${endpoint.body.method} ${endpoint.body.path} — ${endpoint.title}\n  ${baseUrl}/reference/${endpoint.slug}.md`;
    }),
    "",
  ]);

  return lines.length
    ? lines.join("\n")
    : "No API reference pages are published.";
};
