import { createFileRoute } from "@tanstack/react-router";
import { siteUrl } from "../lib/seo";
import {
  loadPublicDocumentationSitemap,
  resolvePublicProjectByDomain,
} from "../lib/public-docs";
import { extractProjectSlugFromRequest } from "../lib/public-docs-domain";

const sitemapEntries = [
  { loc: siteUrl("/"), priority: "1.0", changefreq: "weekly" },
  { loc: siteUrl("/license"), priority: "0.2", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const domainSlug = extractProjectSlugFromRequest(request);
        if (!domainSlug) return xmlResponse(formatSitemap(sitemapEntries));

        try {
          const identity = await resolvePublicProjectByDomain(domainSlug);
          if (!identity) throw new Error("Documentation not found");
          const sitemap = await loadPublicDocumentationSitemap(
            identity.organizationSlug,
            identity.projectSlug,
          );
          const origin = new URL(request.url).origin;
          return xmlResponse(
            formatSitemap(
              sitemap.entries.map((entry) => ({
                ...entry,
                loc: new URL(entry.path, origin).toString(),
              })),
            ),
          );
        } catch {
          return xmlResponse(formatSitemap([]), 404);
        }
      },
    },
  },
});

type SitemapEntry = {
  loc: string;
  changefreq: string;
  priority: string;
};

function formatSitemap(entries: SitemapEntry[]) {
  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function xmlResponse(xml: string, status = 200) {
  return new Response(xml, {
    status,
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "application/xml; charset=utf-8",
    },
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
