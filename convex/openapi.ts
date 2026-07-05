import { parse as parseYaml } from "yaml";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProjectRole } from "./lib/authorization";
import {
  uniqueEndpointSlug,
  uniqueSectionSlug,
} from "./lib/apiDocumentation";
import { appError, ERROR_CODES } from "./lib/errors";
import { importedSectionValidator } from "./lib/validators";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_SECTIONS = 100;
const MAX_ENDPOINTS = 1000;
const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
] as const;

type JsonObject = Record<string, unknown>;
type ImportedSection = {
  title: string;
  endpoints: ImportedEndpoint[];
};
type ImportedEndpoint = {
  title: string;
  content?: string;
  markdown?: string;
  body: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
    path: string;
    description: string;
    parameters: Array<{
      name: string;
      location: string;
      required: boolean;
      description: string;
      dataType: string;
    }>;
    requestBody: Array<{
      name: string;
      dataType: string;
      required: boolean;
      description: string;
      fields?: ImportedEndpoint["body"]["requestBody"];
    }>;
    authHeader: {
      type: "none" | "bearer" | "apiKey" | "basic";
      key: string;
      value: string;
    };
    sampleResponses: Array<{
      statusCode: number;
      description: string;
      body: string;
    }>;
  };
};
type ImportedRequestBodyField =
  ImportedEndpoint["body"]["requestBody"][number];

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function schemaType(value: unknown): string {
  const schema = object(value);
  if (!schema) return "unknown";
  if (schema.type === "array") {
    return `array<${schemaType(schema.items)}>`;
  }
  return text(schema.type) || text(schema.format) || "object";
}

function stringify(value: unknown) {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function normalizeParameters(...groups: unknown[]) {
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map(object)
    .filter((parameter): parameter is JsonObject => parameter !== undefined)
    .filter((parameter) => typeof parameter.name === "string")
    .map((parameter) => ({
      name: text(parameter.name),
      location: text(parameter.in),
      required: parameter.required === true || parameter.in === "path",
      description: text(parameter.description),
      dataType: schemaType(parameter.schema),
    }));
}

function normalizeSchemaFields(
  value: unknown,
  depth = 0,
): ImportedRequestBodyField[] {
  if (depth > 5) return [];
  const schema = object(value);
  const properties = object(schema?.properties);
  const required = new Set(
    Array.isArray(schema?.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [],
  );

  return Object.entries(properties ?? {}).map(([name, property]) => {
    const propertySchema = object(property);
    const nestedSchema =
      propertySchema?.type === "array"
        ? object(propertySchema.items)
        : propertySchema;
    const fields: ImportedRequestBodyField[] = normalizeSchemaFields(
      nestedSchema,
      depth + 1,
    );
    return {
      name,
      dataType: schemaType(property),
      required: required.has(name),
      description: text(propertySchema?.description),
      ...(fields.length ? { fields } : {}),
    };
  });
}

function normalizeRequestBody(value: unknown) {
  const requestBody = object(value);
  const mediaType = object(object(requestBody?.content)?.["application/json"]);
  return normalizeSchemaFields(mediaType?.schema);
}

function normalizeResponses(value: unknown) {
  const responses = object(value);
  return Object.entries(responses ?? {}).map(([status, response]) => {
    const responseObject = object(response);
    const mediaType = object(
      object(responseObject?.content)?.["application/json"],
    );
    const parsedStatus = Number.parseInt(status, 10);
    return {
      statusCode: Number.isNaN(parsedStatus) ? 0 : parsedStatus,
      description: text(responseObject?.description),
      body: stringify(mediaType?.example ?? mediaType?.schema),
    };
  });
}

function normalizeSecurity(
  operation: JsonObject,
  specification: JsonObject,
): ImportedEndpoint["body"]["authHeader"] {
  const requirements = Array.isArray(operation.security)
    ? operation.security
    : Array.isArray(specification.security)
      ? specification.security
      : [];
  const firstRequirement = object(requirements[0]);
  const schemeName = firstRequirement && Object.keys(firstRequirement)[0];
  const schemes = object(object(specification.components)?.securitySchemes);
  const scheme = schemeName ? object(schemes?.[schemeName]) : undefined;

  if (scheme?.type === "http" && scheme.scheme === "bearer") {
    return { type: "bearer", key: "Authorization", value: "" };
  }
  if (scheme?.type === "http" && scheme.scheme === "basic") {
    return { type: "basic", key: "Authorization", value: "" };
  }
  if (scheme?.type === "apiKey") {
    return { type: "apiKey", key: text(scheme.name), value: "" };
  }
  return { type: "none", key: "", value: "" };
}

function normalizeSpecification(value: unknown): ImportedSection[] {
  const specification = object(value);
  if (!specification || !/^3\.(0|1)\.\d+$/.test(text(specification.openapi))) {
    throw appError(
      ERROR_CODES.validation,
      "Only OpenAPI 3.0.x and 3.1.x specifications are supported",
    );
  }

  const paths = object(specification.paths);
  if (!paths) {
    throw appError(ERROR_CODES.validation, "The specification must define paths");
  }

  const sections = new Map<string, ImportedSection>();
  let endpointCount = 0;

  for (const [path, pathValue] of Object.entries(paths)) {
    const pathObject = object(pathValue);
    if (!pathObject) continue;

    for (const method of HTTP_METHODS) {
      const operation = object(pathObject[method]);
      if (!operation) continue;

      endpointCount += 1;
      if (endpointCount > MAX_ENDPOINTS) {
        throw appError(
          ERROR_CODES.validation,
          `Specifications may contain at most ${MAX_ENDPOINTS} operations`,
        );
      }

      const firstTag = Array.isArray(operation.tags)
        ? operation.tags.find((tag): tag is string => typeof tag === "string")
        : undefined;
      const sectionTitle = firstTag?.trim() || "General";
      let section = sections.get(sectionTitle);
      if (!section) {
        if (sections.size >= MAX_SECTIONS) {
          throw appError(
            ERROR_CODES.validation,
            `Specifications may contain at most ${MAX_SECTIONS} sections`,
          );
        }
        section = { title: sectionTitle, endpoints: [] };
        sections.set(sectionTitle, section);
      }

      const description = text(operation.description);
      section.endpoints.push({
        title:
          text(operation.summary).trim() ||
          text(operation.operationId).trim() ||
          `${method.toUpperCase()} ${path}`,
        content: description || undefined,
        markdown: description || undefined,
        body: {
          method: method.toUpperCase() as ImportedEndpoint["body"]["method"],
          path,
          description,
          parameters: normalizeParameters(
            pathObject.parameters,
            operation.parameters,
          ),
          requestBody: normalizeRequestBody(operation.requestBody),
          authHeader: normalizeSecurity(operation, specification),
          sampleResponses: normalizeResponses(operation.responses),
        },
      });
    }
  }

  if (endpointCount === 0) {
    throw appError(
      ERROR_CODES.validation,
      "The specification does not contain any supported operations",
    );
  }

  return [...sections.values()];
}

export const authorizeImport = internalQuery({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
  },
  returns: v.literal(true),
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, ["owner", "admin"]);
    if (args.versionId) {
      const version = await ctx.db.get(args.versionId);
      if (!version || version.projectId !== args.projectId) {
        throw appError(
          ERROR_CODES.validation,
          "Documentation version does not belong to this project",
        );
      }
    }
    return true as const;
  },
});

export const replaceImportedDocumentation = internalMutation({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    sections: v.array(importedSectionValidator),
  },
  returns: v.object({
    sectionCount: v.number(),
    endpointCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const existingEndpoints = args.versionId
      ? await ctx.db
          .query("apiEndpoints")
          .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
          .collect()
      : await ctx.db
          .query("apiEndpoints")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
          .then((endpoints) =>
            endpoints.filter((endpoint) => endpoint.versionId === undefined),
          );
    const existingSections = args.versionId
      ? await ctx.db
          .query("apiSections")
          .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
          .collect()
      : await ctx.db
          .query("apiSections")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
          .then((sections) =>
            sections.filter((section) => section.versionId === undefined),
          );

    for (const endpoint of existingEndpoints) await ctx.db.delete(endpoint._id);
    for (const section of existingSections) await ctx.db.delete(section._id);

    const now = Date.now();
    let endpointCount = 0;
    for (const [sectionPosition, importedSection] of args.sections.entries()) {
      const sectionId = await ctx.db.insert("apiSections", {
        projectId: args.projectId,
        versionId: args.versionId,
        title: importedSection.title,
        slug: await uniqueSectionSlug(
          ctx,
          args.projectId,
          args.versionId,
          importedSection.title,
        ),
        position: sectionPosition,
        updatedAt: now,
      });

      for (const [position, endpoint] of importedSection.endpoints.entries()) {
        await ctx.db.insert("apiEndpoints", {
          projectId: args.projectId,
          versionId: args.versionId,
          sectionId,
          title: endpoint.title,
          slug: await uniqueEndpointSlug(
            ctx,
            args.projectId,
            args.versionId,
            endpoint.title,
          ),
          endpointType: "endpoint",
          content: endpoint.content,
          markdown: endpoint.markdown,
          body: endpoint.body,
          position,
          updatedAt: now,
        });
        endpointCount += 1;
      }
    }

    return { sectionCount: args.sections.length, endpointCount };
  },
});

export const importSpecification = action({
  args: {
    projectId: v.id("apiProjects"),
    versionId: v.optional(v.id("documentationVersions")),
    content: v.string(),
    format: v.union(v.literal("json"), v.literal("yaml")),
  },
  returns: v.object({
    sectionCount: v.number(),
    endpointCount: v.number(),
    conflictPolicy: v.literal("replace"),
  }),
  handler: async (ctx, args): Promise<{
    sectionCount: number;
    endpointCount: number;
    conflictPolicy: "replace";
  }> => {
    await ctx.runQuery(internal.openapi.authorizeImport, {
      projectId: args.projectId,
      versionId: args.versionId,
    });

    if (new TextEncoder().encode(args.content).byteLength > MAX_FILE_BYTES) {
      throw appError(
        ERROR_CODES.validation,
        `OpenAPI files may not exceed ${MAX_FILE_BYTES} bytes`,
      );
    }

    let parsed: unknown;
    try {
      parsed =
        args.format === "json"
          ? JSON.parse(args.content)
          : parseYaml(args.content);
    } catch {
      throw appError(
        ERROR_CODES.validation,
        `The OpenAPI ${args.format.toUpperCase()} file could not be parsed`,
      );
    }

    const sections = normalizeSpecification(parsed);
    const result = await ctx.runMutation(
      internal.openapi.replaceImportedDocumentation,
      { projectId: args.projectId, versionId: args.versionId, sections },
    );

    return { ...result, conflictPolicy: "replace" };
  },
});
