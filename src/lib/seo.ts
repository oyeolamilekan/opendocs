export const SITE_NAME = "openapidoc";
export const SITE_DESCRIPTION =
  "Open-source API documentation for developers and AI agents. Publish fast, searchable references, guides, OpenAPI exports, llms.txt, and read-only MCP servers without enterprise pricing.";
export const SITE_KEYWORDS =
  "open source API documentation, AI agent documentation, MCP documentation server, OpenAPI docs, llms.txt, developer docs platform";

const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_OG_IMAGE = "/logo512.png";

export type SeoMetaOptions = {
  title?: string;
  description?: string;
  path?: string;
  url?: string;
  image?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
};

export const siteUrl = (path = "/") => {
  return absoluteUrl(path, configuredSiteOrigin());
};

export const publicDocsUrl = ({
  projectSlug,
  path = "/",
}: {
  projectSlug: string;
  path?: string;
}) => {
  const site = new URL(configuredSiteOrigin());
  const rootDomain = (import.meta.env.VITE_PUBLIC_DOCS_ROOT_DOMAIN ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
  const domain = rootDomain || site.hostname;
  const port =
    site.port && (domain === "localhost" || domain.endsWith(".localhost"))
      ? `:${site.port}`
      : "";
  const protocol = site.protocol.replace(/:$/, "");
  const normalizedPath = normalizePath(path);

  return `${protocol}://${projectSlug}.${domain}${port}${normalizedPath}`;
};

export const seoMeta = ({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  url,
  image,
  type = "website",
  noindex = false,
}: SeoMetaOptions = {}) => {
  const resolvedTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const resolvedUrl = url ?? siteUrl(path);
  const resolvedImage = image
    ? absoluteUrl(image, resolvedUrl)
    : siteUrl(DEFAULT_OG_IMAGE);
  const resolvedDescription = seoDescription(description);

  return [
    { title: resolvedTitle },
    { name: "description", content: resolvedDescription },
    { name: "keywords", content: SITE_KEYWORDS },
    {
      name: "robots",
      content: noindex ? "noindex,nofollow" : "index,follow",
    },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: type },
    { property: "og:title", content: resolvedTitle },
    { property: "og:description", content: resolvedDescription },
    { property: "og:url", content: resolvedUrl },
    { property: "og:image", content: resolvedImage },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: resolvedTitle },
    { name: "twitter:description", content: resolvedDescription },
    { name: "twitter:image", content: resolvedImage },
  ];
};

export const seoLinks = ({ url }: { url?: string | null }) => {
  return url ? [{ rel: "canonical", href: url }] : [];
};

export const seoAssetLinks = () => {
  return [
    { rel: "manifest", href: "/manifest.json" },
    { rel: "icon", href: "/favicon.ico" },
    { rel: "apple-touch-icon", href: "/logo192.png" },
  ];
};

export const seoDescription = (description: string) => {
  const compact = description.replace(/\s+/g, " ").trim();
  if (compact.length <= 160) return compact;
  return `${compact.slice(0, 157).trimEnd()}...`;
};

const configuredSiteOrigin = () => {
  const configured = (import.meta.env.VITE_SITE_URL ?? DEFAULT_SITE_URL).trim();
  try {
    return new URL(configured).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
};

const absoluteUrl = (value: string, base: string) => {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
};

const normalizePath = (path: string) => {
  return path.startsWith("/") ? path : `/${path}`;
};
