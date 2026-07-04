import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHost,
  getRequestProtocol,
} from "@tanstack/react-start/server";

const RESERVED_SUBDOMAINS = new Set(["app", "www"]);

export const getPublicProjectSlugFromRequest = createServerFn({
  method: "GET",
}).handler(() => {
  return extractProjectSlugFromHostname(
    getRequestHost({ xForwardedHost: true }),
  );
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

/**
 * Extracts a project slug from a public documentation hostname.
 *
 * @param host - Host header or hostname, optionally including a port.
 * @returns Result produced by the function.
 */
export const extractProjectSlugFromHostname = (host: string) => {
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
};

/**
 * Extracts a project slug from a public documentation request URL.
 *
 * @param request - Incoming request to inspect.
 * @returns Result produced by the function.
 */
export const extractProjectSlugFromRequest = (request: Request) => {
  return extractProjectSlugFromHostname(new URL(request.url).host);
};

/**
 * Builds an absolute public documentation URL for a project subdomain.
 *
 * @param options - Function options.
 * @param options.projectSlug - Public project slug.
 * @param [options.path] - Path or route value to normalize or append.
 * @param options.protocol - URL protocol to use when building the origin.
 * @param options.host - Host header or hostname, optionally including a port.
 * @returns Result produced by the function.
 */
export const buildPublicDocumentationUrl = ({
  projectSlug,
  path = "/",
  protocol,
  host,
}: {
  projectSlug: string;
  path?: string;
  protocol: string;
  host: string;
}) => {
  const { hostname, port } = splitHost(host);
  const rootDomain = inferRootDomain(hostname);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const portSuffix = port ? `:${port}` : "";

  return `${protocol}://${projectSlug}.${rootDomain}${portSuffix}${normalizedPath}`;
};

/**
 * Builds a browser-facing public documentation URL from the current origin.
 *
 * @param projectSlug - Public project slug.
 * @param [path="/"] - Path or route value to normalize or append.
 * @returns Result produced by the function.
 */
export const buildBrowserPublicDocumentationUrl = (
  projectSlug: string,
  path = "/",
) => {
  if (typeof window === "undefined") return path;
  return buildPublicDocumentationUrl({
    projectSlug,
    path,
    protocol: window.location.protocol.replace(":", ""),
    host: window.location.host,
  });
};

/**
 * Infers the root documentation domain from a hostname.
 *
 * @param hostname - Hostname value to inspect.
 * @returns Inferred root domain.
 */
const inferRootDomain = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  const configured = getConfiguredRootDomain();

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return "localhost";
  }
  if (configured) return configured;

  const labels = normalized.split(".");
  return labels.length >= 3 ? labels.slice(1).join(".") : normalized;
};

/**
 * Reads the configured public documentation root domain.
 *
 * @returns Configured root domain, or undefined when not set.
 */
const getConfiguredRootDomain = () => {
  return (import.meta.env.VITE_PUBLIC_DOCS_ROOT_DOMAIN ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
};

/**
 * Removes a port suffix from a host string.
 *
 * @param host - Host value to inspect.
 * @returns Host string without a port.
 */
const stripPort = (host: string) => {
  return splitHost(host).hostname;
};

/**
 * Splits a hostname into non-empty host labels.
 *
 * @param host - Host value to inspect.
 * @returns Host labels.
 */
const splitHost = (host: string) => {
  const match = host.match(/^(.*?)(?::(\d+))?$/);
  return {
    hostname: match?.[1] ?? host,
    port: match?.[2] ?? "",
  };
};

/**
 * Checks whether a host label is valid as a project subdomain.
 *
 * @param value - Value to inspect or format.
 * @returns True when the value can be used as a project subdomain.
 */
const validSubdomain = (value: string) => {
  if (
    !value ||
    value.includes(".") ||
    RESERVED_SUBDOMAINS.has(value) ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)
  ) {
    return null;
  }

  return value;
};
