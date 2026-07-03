import { ConvexHttpClient } from "convex/browser";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { joinEndpointUrl } from "./endpoint-path";

let publicClient: ConvexHttpClient | null = null;

export function getPublicClient() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error("VITE_CONVEX_URL is not configured");
  publicClient ??= new ConvexHttpClient(convexUrl);
  return publicClient;
}

export function publicProjectQueries(
  organizationSlug: string,
  projectSlug: string,
  versionSlug?: string,
) {
  const args = { organizationSlug, projectSlug, versionSlug };
  const projectArgs = { organizationSlug, projectSlug };
  return {
    project: convexQuery(api.projects.getPublic, projectArgs),
    navigation: convexQuery(api.sections.publicNavigation, args),
    guides: convexQuery(api.guides.publicNavigation, args),
    customNavigation: convexQuery(
      api.documentationNavigation.publicNavigation,
      args,
    ),
    aiSettings: convexQuery(api.ai.getPublicSettingsBySlug, projectArgs),
    versions: convexQuery(api.versions.publicList, projectArgs),
  };
}

export function publicDomainProjectQuery(projectSlug: string) {
  return convexQuery(api.projects.getPublicByDomain, { projectSlug });
}

export async function resolvePublicProjectByDomain(projectSlug: string) {
  return await getPublicClient().query(api.projects.getPublicByDomain, {
    projectSlug,
  });
}

export function publicEndpointQueries(
  organizationSlug: string,
  projectSlug: string,
  endpointSlug: string,
  versionSlug?: string,
) {
  return {
    ...publicProjectQueries(organizationSlug, projectSlug, versionSlug),
    endpoint: convexQuery(api.endpoints.getPublicBySlug, {
      organizationSlug,
      projectSlug,
      versionSlug,
      endpointSlug,
    }),
  };
}

export function publicGuidePageQueries(
  organizationSlug: string,
  projectSlug: string,
  guideSlug: string,
  versionSlug?: string,
) {
  return {
    ...publicProjectQueries(organizationSlug, projectSlug, versionSlug),
    guidePage: convexQuery(api.guides.getPublicBySlug, {
      organizationSlug,
      projectSlug,
      versionSlug,
      guideSlug,
    }),
  };
}

export async function loadPublicProject(
  organizationSlug: string,
  projectSlug: string,
  versionSlug?: string,
) {
  const client = getPublicClient();
  const args = { organizationSlug, projectSlug, versionSlug };
  const projectArgs = { organizationSlug, projectSlug };
  const [project, navigation, guides, customNavigation, aiSettings, versions] =
    await Promise.all([
      client.query(api.projects.getPublic, projectArgs),
      client.query(api.sections.publicNavigation, args),
      client.query(api.guides.publicNavigation, args),
      client.query(api.documentationNavigation.publicNavigation, args),
      client.query(api.ai.getPublicSettingsBySlug, projectArgs),
      client.query(api.versions.publicList, projectArgs),
    ]);
  return { project, navigation, guides, customNavigation, aiSettings, versions };
}

export async function loadPublicEndpoint(
  organizationSlug: string,
  projectSlug: string,
  endpointSlug: string,
  versionSlug?: string,
) {
  const client = getPublicClient();
  const args = { organizationSlug, projectSlug, versionSlug };
  const projectArgs = { organizationSlug, projectSlug };
  const [
    project,
    navigation,
    guides,
    customNavigation,
    aiSettings,
    versions,
    endpoint,
  ] = await Promise.all([
    client.query(api.projects.getPublic, projectArgs),
    client.query(api.sections.publicNavigation, args),
    client.query(api.guides.publicNavigation, args),
    client.query(api.documentationNavigation.publicNavigation, args),
    client.query(api.ai.getPublicSettingsBySlug, projectArgs),
    client.query(api.versions.publicList, projectArgs),
    client.query(api.endpoints.getPublicBySlug, {
      ...args,
      endpointSlug,
    }),
  ]);
  return {
    project,
    navigation,
    guides,
    customNavigation,
    aiSettings,
    versions,
    endpoint,
  };
}

export async function loadPublicGuidePage(
  organizationSlug: string,
  projectSlug: string,
  guideSlug: string,
  versionSlug?: string,
) {
  const client = getPublicClient();
  const args = { organizationSlug, projectSlug, versionSlug };
  const projectArgs = { organizationSlug, projectSlug };
  const [
    project,
    navigation,
    guides,
    customNavigation,
    aiSettings,
    versions,
    guidePage,
  ] = await Promise.all([
    client.query(api.projects.getPublic, projectArgs),
    client.query(api.sections.publicNavigation, args),
    client.query(api.guides.publicNavigation, args),
    client.query(api.documentationNavigation.publicNavigation, args),
    client.query(api.ai.getPublicSettingsBySlug, projectArgs),
    client.query(api.versions.publicList, projectArgs),
    client.query(api.guides.getPublicBySlug, { ...args, guideSlug }),
  ]);
  return {
    project,
    navigation,
    guides,
    customNavigation,
    aiSettings,
    versions,
    guidePage,
  };
}

export async function loadPublicDocumentationExport(
  organizationSlug: string,
  projectSlug: string,
  versionSlug?: string,
) {
  const client = getPublicClient();
  const args = { organizationSlug, projectSlug, versionSlug };
  const projectArgs = { organizationSlug, projectSlug };
  const [project, navigation, guides, versions] = await Promise.all([
    client.query(api.projects.getPublic, projectArgs),
    client.query(api.sections.publicNavigation, args),
    client.query(api.guides.publicNavigation, args),
    client.query(api.versions.publicList, projectArgs),
  ]);
  const [sections, guideSections] = await Promise.all([
    Promise.all(
      navigation.map(async (section) => ({
        title: section.title,
        slug: section.slug,
        position: section.position,
        endpoints: await Promise.all(
          section.endpoints.map((endpoint) =>
            client.query(api.endpoints.getPublicBySlug, {
              ...args,
              endpointSlug: endpoint.slug,
            }),
          ),
        ),
      })),
    ),
    Promise.all(
      guides.map(async (section) => ({
        title: section.title,
        slug: section.slug,
        position: section.position,
        pages: await Promise.all(
          section.pages.map((page) =>
            client.query(api.guides.getPublicBySlug, {
              ...args,
              guideSlug: page.slug,
            }),
          ),
        ),
      })),
    ),
  ]);

  return { project, sections, guides: guideSections, versions };
}

export function buildRequestUrl(
  baseUrl: string,
  path: string,
  parameters: Array<{ name: string; location: string }>,
  values: Record<string, string>,
) {
  let resolvedPath = path;
  for (const parameter of parameters) {
    if (parameter.location === "path" && values[parameter.name]) {
      resolvedPath = resolvedPath.replaceAll(
        `{${parameter.name}}`,
        encodeURIComponent(values[parameter.name]),
      );
    }
  }
  const [pathname, existingQuery = ""] = resolvedPath.split("?", 2);
  const searchParams = new URLSearchParams(existingQuery);
  for (const parameter of parameters) {
    const value = values[parameter.name];
    if (parameter.location !== "path" && value) {
      searchParams.set(parameter.name, value);
    }
  }
  const query = searchParams.toString();
  return `${joinEndpointUrl(baseUrl, pathname)}${query ? `?${query}` : ""}`;
}

function indentFollowingLines(value: string, spaces: number) {
  const indentation = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${indentation}${line}`))
    .join("\n");
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function formatPythonValue(value: unknown, depth = 0): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  const indentation = " ".repeat(depth * 4);
  const childIndentation = " ".repeat((depth + 1) * 4);

  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value
      .map(
        (item) =>
          `${childIndentation}${formatPythonValue(item, depth + 1)},`,
      )
      .join("\n")}\n${indentation}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{\n${entries
      .map(
        ([key, item]) =>
          `${childIndentation}${JSON.stringify(key)}: ${formatPythonValue(
            item,
            depth + 1,
          )},`,
      )
      .join("\n")}\n${indentation}}`;
  }

  return "None";
}

function formatRubyValue(value: unknown, depth = 0): string {
  if (value === null) return "nil";
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);

  const indentation = " ".repeat(depth * 2);
  const childIndentation = " ".repeat((depth + 1) * 2);

  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value
      .map(
        (item) => `${childIndentation}${formatRubyValue(item, depth + 1)},`,
      )
      .join("\n")}\n${indentation}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{\n${entries
      .map(
        ([key, item]) =>
          `${childIndentation}${JSON.stringify(key)} => ${formatRubyValue(
            item,
            depth + 1,
          )},`,
      )
      .join("\n")}\n${indentation}}`;
  }

  return "nil";
}

export function generateCodeExamples({
  method,
  url,
  authType,
  authKey,
  hasBody,
  bodyValues = {},
  credential,
}: {
  method: string;
  url: string;
  authType: "none" | "bearer" | "apiKey" | "basic";
  authKey: string;
  hasBody: boolean;
  bodyValues?: Record<string, unknown>;
  credential?: string;
}) {
  const headerKey =
    authKey.trim() ||
    (authType === "apiKey" ? "X-API-Key" : "Authorization");
  const credentialValue =
    credential ||
    (authType === "bearer"
      ? "YOUR_TOKEN"
      : authType === "basic"
        ? "YOUR_CREDENTIALS"
        : "YOUR_API_KEY");
  const authHeader =
    authType === "bearer"
      ? `${headerKey}: Bearer ${credentialValue}`
      : authType === "basic"
        ? `${headerKey}: Basic ${credentialValue}`
        : authType === "apiKey"
          ? `${headerKey}: ${credentialValue}`
          : null;
  const headers = [
    authHeader,
    hasBody ? "Content-Type: application/json" : null,
  ].filter(Boolean) as string[];
  const populatedBody = Object.fromEntries(
    Object.entries(bodyValues).filter(([, value]) => value !== ""),
  );
  const requestBody = Object.keys(populatedBody).length
    ? populatedBody
    : { field: "value" };
  const jsonBody = JSON.stringify(requestBody, null, 2);
  const jsHeaders = Object.fromEntries(
    headers.map((header) => {
      const separator = header.indexOf(":");
      return [header.slice(0, separator), header.slice(separator + 1).trim()];
    }),
  );
  const javascriptOptions = [`  method: ${JSON.stringify(method)}`];
  if (headers.length) {
    javascriptOptions.push(
      `  headers: ${indentFollowingLines(
        JSON.stringify(jsHeaders, null, 2),
        2,
      )}`,
    );
  }
  if (hasBody) {
    javascriptOptions.push(
      `  body: JSON.stringify(${indentFollowingLines(jsonBody, 2)})`,
    );
  }

  const curlParts = [
    `curl --request ${method}`,
    `  --url ${shellQuote(url)}`,
    ...headers.map((header) => `  --header ${shellQuote(header)}`),
  ];
  if (hasBody) {
    curlParts.push(
      `  --data ${shellQuote(indentFollowingLines(jsonBody, 2))}`,
    );
  }

  const pythonArguments = [`    ${JSON.stringify(url)},`];
  if (headers.length) {
    pythonArguments.push(
      `    headers=${formatPythonValue(jsHeaders, 1)},`,
    );
  }
  if (hasBody) {
    pythonArguments.push(
      `    json=${formatPythonValue(requestBody, 1)},`,
    );
  }

  const rubyRequestClass =
    method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  const rubyHeaders = Object.entries(jsHeaders)
    .map(
      ([key, value]) =>
        `request[${JSON.stringify(key)}] = ${JSON.stringify(value)}`,
    )
    .join("\n");
  const rubyBody = hasBody
    ? `request.body = JSON.generate(\n  ${formatRubyValue(requestBody, 1)}\n)`
    : "";

  return {
    JavaScript: `const response = await fetch(${JSON.stringify(url)}, {
${javascriptOptions.join(",\n")}
});

console.log(await response.json());`,
    cURL: curlParts.join(" \\\n"),
    Python: `import requests

response = requests.${method.toLowerCase()}(
${pythonArguments.join("\n")}
)

print(response.json())`,
    Ruby: `require "net/http"
require "json"

uri = URI(${JSON.stringify(url)})
request = Net::HTTP::${rubyRequestClass}.new(uri)
${[rubyHeaders, rubyBody].filter(Boolean).join("\n")}

response = Net::HTTP.start(
  uri.hostname,
  uri.port,
  use_ssl: uri.scheme == "https"
) do |http|
  http.request(request)
end

puts response.body`,
  };
}
