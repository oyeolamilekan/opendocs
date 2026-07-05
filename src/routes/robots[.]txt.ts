import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sitemapUrl = new URL("/sitemap.xml", request.url).toString();
        return textResponse(
          [
            "User-agent: *",
            "Allow: /",
            "Disallow: /app/",
            "Disallow: /api/",
            "Disallow: /auth/",
            "",
            `Sitemap: ${sitemapUrl}`,
            "",
          ].join("\n"),
        );
      },
    },
  },
});

function textResponse(text: string) {
  return new Response(text, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
