import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { getPublicClient, loadPublicEndpoint } from "../../lib/public-docs";

const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8_000;

type ExecuteInput = {
  organizationSlug: string;
  projectSlug: string;
  endpointSlug: string;
  parameters?: Record<string, string>;
  body?: Record<string, unknown>;
  credential?: string;
};

type ApiCallAnalyticsPayload = {
  organizationSlug: string;
  projectSlug: string;
  endpointSlug: string;
  endpointTitle: string;
  endpointPath: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  userAgent?: string;
};

export const Route = createFileRoute("/api/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let analyticsPayload: ApiCallAnalyticsPayload | null = null;
        let requestStartedAt = 0;
        try {
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > MAX_REQUEST_BYTES) {
            return json({ error: "Request input is too large" }, 413);
          }
          const input = (await request.json()) as ExecuteInput;
          const data = await loadPublicEndpoint(
            input.organizationSlug,
            input.projectSlug,
            input.endpointSlug,
          );
          analyticsPayload = {
            organizationSlug: input.organizationSlug,
            projectSlug: input.projectSlug,
            endpointSlug: input.endpointSlug,
            endpointTitle: data.endpoint.title,
            endpointPath: data.endpoint.body.path,
            method: data.endpoint.body.method,
            userAgent: request.headers.get("user-agent") ?? undefined,
          };
          const target = buildTargetUrl(
            data.project.project.baseUrl,
            data.endpoint.body.path,
            data.endpoint.body.parameters,
            input.parameters ?? {},
          );
          requestStartedAt = Date.now();
          const result = await executeRequest({
            url: target,
            method: data.endpoint.body.method,
            auth: data.endpoint.body.authHeader,
            credential: input.credential ?? "",
            body:
              data.endpoint.body.requestBody.length > 0
                ? input.body ?? {}
                : undefined,
          });
          await recordApiCall({
            ...analyticsPayload,
            status: result.status,
            durationMs: Date.now() - requestStartedAt,
          });
          return json(result, 200);
        } catch (error) {
          if (analyticsPayload) {
            await recordApiCall({
              ...analyticsPayload,
              status: 0,
              durationMs: requestStartedAt ? Date.now() - requestStartedAt : 0,
            });
          }
          const message =
            error instanceof Error ? error.message : "Request execution failed";
          const status = message.includes("not allowed") ? 403 : 400;
          return json({ error: message }, status);
        }
      },
    },
  },
});

async function recordApiCall(
  value: ApiCallAnalyticsPayload & { status: number; durationMs: number },
) {
  try {
    await getPublicClient().mutation(api.analytics.recordApiCall, value);
  } catch {
    // Analytics must never block the endpoint tester response.
  }
}

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function buildTargetUrl(
  baseUrl: string,
  path: string,
  parameters: Array<{ name: string; location: string; required: boolean }>,
  values: Record<string, string>,
) {
  let resolvedPath = path;
  for (const parameter of parameters) {
    const value = values[parameter.name]?.trim();
    if (parameter.required && !value) {
      throw new Error(`Required parameter "${parameter.name}" is missing`);
    }
    if (parameter.location === "path" && value) {
      resolvedPath = resolvedPath.replace(
        `{${parameter.name}}`,
        encodeURIComponent(value),
      );
    }
  }
  if (/\{[^}]+\}/.test(resolvedPath)) {
    throw new Error("All path parameters must be provided");
  }

  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol)) {
    throw new Error("Only HTTP and HTTPS targets are allowed");
  }
  if (base.username || base.password) {
    throw new Error("Target credentials in URLs are not allowed");
  }
  if (
    (base.protocol === "http:" && base.port && base.port !== "80") ||
    (base.protocol === "https:" && base.port && base.port !== "443")
  ) {
    throw new Error("Only standard HTTP and HTTPS ports are allowed");
  }

  const target = new URL(resolvedPath, `${base.toString().replace(/\/$/, "")}/`);
  if (target.origin !== base.origin) {
    throw new Error("Endpoint paths cannot change the configured API origin");
  }
  for (const parameter of parameters) {
    const value = values[parameter.name]?.trim();
    if (parameter.location !== "path" && value) {
      target.searchParams.set(parameter.name, value);
    }
  }
  return target;
}

async function executeRequest({
  url,
  method,
  auth,
  credential,
  body,
}: {
  url: URL;
  method: string;
  auth: { type: "none" | "bearer" | "apiKey" | "basic"; key: string };
  credential: string;
  body?: Record<string, unknown>;
}) {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error("This target network is not allowed");
  }

  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload && Buffer.byteLength(payload) > MAX_REQUEST_BYTES) {
    throw new Error("Request body is too large");
  }
  const headers: Record<string, string> = {
    accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    host: url.host,
    "user-agent": "openapidoc-Endpoint-Tester/1.0",
  };
  if (payload) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(payload));
  }
  if (credential) {
    if (auth.type === "bearer") headers.authorization = `Bearer ${credential}`;
    if (auth.type === "basic") headers.authorization = `Basic ${credential}`;
    if (auth.type === "apiKey") headers[auth.key || "x-api-key"] = credential;
  }

  const address = addresses[0]!;
  const transport = url.protocol === "https:" ? https : http;
  return await new Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    contentType: string;
  }>((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: address.address,
        family: address.family,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        method,
        path: `${url.pathname}${url.search}`,
        headers,
        servername: url.hostname,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy(new Error("Response exceeded the 1 MiB limit"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const contentType = String(response.headers["content-type"] ?? "");
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = text;
          if (contentType.includes("json")) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
          }
          resolve({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? "",
            headers: Object.fromEntries(
              Object.entries(response.headers)
                .filter(([key]) =>
                  ["content-type", "content-length", "cache-control", "date"].includes(
                    key,
                  ),
                )
                .map(([key, value]) => [key, String(value ?? "")]),
            ),
            body: parsed,
            contentType,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export function isBlockedIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIp(normalized.slice("::ffff:".length));
  }
  return (
    version !== 6 ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("ff")
  );
}
