import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";

const RESERVED_SUBDOMAINS = new Set(["app", "www"]);

export const getPublicProjectSlugFromRequest = createServerFn({
  method: "GET",
}).handler(() => {
  return extractProjectSlugFromHostname(getRequestHost({ xForwardedHost: true }));
});

export const getPublicDocumentationUrl = createServerFn({
  method: "GET",
})
  .validator((input: { projectSlug: string; path?: string }) => input)
  .handler(({ data }) => {
    return buildPublicDocumentationUrl({
      projectSlug: data.projectSlug,
      path: data.path,
      protocol: getRequestProtocol(),
      host: getRequestHost({ xForwardedHost: true }),
    });
  });

export function extractProjectSlugFromHostname(host: string) {
  const hostname = stripPort(host).toLowerCase();
  const rootDomain = getConfiguredRootDomain();

  if (hostname === "localhost" || hostname === rootDomain) {
    return null;
  }

  if (hostname.endsWith(".localhost")) {
    return validSubdomain(hostname.slice(0, -".localhost".length));
  }

  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    return validSubdomain(hostname.slice(0, -(rootDomain.length + 1)));
  }

  const labels = hostname.split(".");
  if (labels.length >= 3) {
    return validSubdomain(labels[0]);
  }

  return null;
}

export function extractProjectSlugFromRequest(request: Request) {
  return extractProjectSlugFromHostname(new URL(request.url).host);
}

export function buildPublicDocumentationUrl({
  projectSlug,
  path = "/",
  protocol,
  host,
}: {
  projectSlug: string;
  path?: string;
  protocol: string;
  host: string;
}) {
  const { hostname, port } = splitHost(host);
  const rootDomain = inferRootDomain(hostname);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const portSuffix = port ? `:${port}` : "";

  return `${protocol}://${projectSlug}.${rootDomain}${portSuffix}${normalizedPath}`;
}

export function buildBrowserPublicDocumentationUrl(
  projectSlug: string,
  path = "/",
) {
  if (typeof window === "undefined") return path;
  return buildPublicDocumentationUrl({
    projectSlug,
    path,
    protocol: window.location.protocol.replace(":", ""),
    host: window.location.host,
  });
}

function inferRootDomain(hostname: string) {
  const normalized = hostname.toLowerCase();
  const configured = getConfiguredRootDomain();

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return "localhost";
  }
  if (configured) return configured;

  const labels = normalized.split(".");
  return labels.length >= 3 ? labels.slice(1).join(".") : normalized;
}

function getConfiguredRootDomain() {
  return (import.meta.env.VITE_PUBLIC_DOCS_ROOT_DOMAIN ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

function stripPort(host: string) {
  return splitHost(host).hostname;
}

function splitHost(host: string) {
  const match = host.match(/^(.*?)(?::(\d+))?$/);
  return {
    hostname: match?.[1] ?? host,
    port: match?.[2] ?? "",
  };
}

function validSubdomain(value: string) {
  if (
    !value ||
    value.includes(".") ||
    RESERVED_SUBDOMAINS.has(value) ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)
  ) {
    return null;
  }

  return value;
}
