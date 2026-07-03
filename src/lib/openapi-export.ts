import type { ExportEndpoint, ExportField } from "./markdown-export";

export type OpenApiExportProject = {
  organization: {
    name: string;
    slug: string;
  };
  project: {
    title: string;
    slug: string;
    baseUrl: string;
    description: string;
    updatedAt: number;
  };
};

export type OpenApiExportSection = {
  title: string;
  slug: string;
  position: number;
  endpoints: ExportEndpoint[];
};

export type JsonSchema = {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
};

export function generateOpenApiDocument({
  project,
  sections,
}: {
  project: OpenApiExportProject;
  sections: OpenApiExportSection[];
}) {
  const endpointSections = sections
    .map((section) => ({
      ...section,
      endpoints: section.endpoints.filter(
        (endpoint) => endpoint.endpointType === "endpoint",
      ),
    }))
    .filter((section) => section.endpoints.length > 0);
  const securitySchemes = collectSecuritySchemes(endpointSections);
  const document: Record<string, unknown> = {
    openapi: "3.1.0",
    info: {
      title: project.project.title,
      description: project.project.description,
      version: "1.0.0",
    },
    servers: [{ url: project.project.baseUrl }],
    paths: paths(endpointSections),
  };

  if (Object.keys(securitySchemes).length > 0) {
    document.components = {
      securitySchemes,
    };
  }

  return document;
}

function paths(sections: OpenApiExportSection[]) {
  const result: Record<string, Record<string, unknown>> = {};

  for (const section of sections) {
    for (const endpoint of section.endpoints) {
      result[endpoint.body.path] ??= {};
      result[endpoint.body.path][endpoint.body.method.toLowerCase()] = {
        tags: [section.title],
        summary: endpoint.title,
        description:
          endpoint.body.description || endpoint.markdown || undefined,
        operationId: operationId(endpoint),
        parameters: endpoint.body.parameters.map(openApiParameter),
        requestBody: requestBody(endpoint.body.requestBody),
        responses: responses(endpoint),
        security: security(endpoint),
      };
    }
  }

  return result;
}

function collectSecuritySchemes(sections: OpenApiExportSection[]) {
  const schemes: Record<string, Record<string, string>> = {};

  for (const endpoint of sections.flatMap((section) => section.endpoints)) {
    const auth = endpoint.body.authHeader;
    if (auth.type === "none") continue;
    if (auth.type === "bearer") {
      schemes.BearerAuth = { type: "http", scheme: "bearer" };
    }
    if (auth.type === "basic") {
      schemes.BasicAuth = { type: "http", scheme: "basic" };
    }
    if (auth.type === "apiKey") {
      schemes.ApiKeyAuth = {
        type: "apiKey",
        in: "header",
        name: auth.key || "X-API-Key",
      };
    }
  }

  return schemes;
}

function security(endpoint: ExportEndpoint) {
  if (endpoint.body.authHeader.type === "bearer") return [{ BearerAuth: [] }];
  if (endpoint.body.authHeader.type === "basic") return [{ BasicAuth: [] }];
  if (endpoint.body.authHeader.type === "apiKey") return [{ ApiKeyAuth: [] }];
  return undefined;
}

function openApiParameter(parameter: ExportField) {
  return {
    name: parameter.name,
    in: openApiParameterLocation(parameter.location),
    required: parameter.location === "path" ? true : parameter.required,
    description: parameter.description || undefined,
    schema: schemaFromDataType(parameter.dataType),
  };
}

function openApiParameterLocation(location?: string) {
  if (location === "path" || location === "query" || location === "header") {
    return location;
  }
  return "query";
}

function requestBody(fields: ExportField[]) {
  if (!fields.length) return undefined;

  return {
    required: fields.some((field) => field.required),
    content: {
      "application/json": {
        schema: objectSchema(fields),
      },
    },
  };
}

function responses(endpoint: ExportEndpoint) {
  if (!endpoint.body.sampleResponses.length) {
    return {
      "200": {
        description: "Successful response",
      },
    };
  }

  return Object.fromEntries(
    endpoint.body.sampleResponses.map((response) => [
      String(response.statusCode),
      {
        description: response.description || "Response",
        content: response.body
          ? {
              "application/json": {
                example: parseResponseExample(response.body),
              },
            }
          : undefined,
      },
    ]),
  );
}

export function parseResponseExample(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function objectSchema(fields: ExportField[]): JsonSchema {
  const required = fields
    .filter((field) => field.required)
    .map((field) => field.name);

  return {
    type: "object",
    properties: Object.fromEntries(
      fields.map((field) => [
        field.name,
        {
          ...schemaFromField(field),
          description: field.description || undefined,
        },
      ]),
    ),
    required: required.length ? required : undefined,
    additionalProperties: false,
  };
}

export function schemaFromField(field: ExportField): JsonSchema {
  if (field.fields?.length) return objectSchema(field.fields);
  return schemaFromDataType(field.dataType);
}

export function schemaFromDataType(dataType: string): JsonSchema {
  const normalized = dataType.trim().toLowerCase();

  if (normalized.includes("array")) {
    return {
      type: "array",
      items: schemaFromDataType(normalized.replace(/array|[\[\]<>]/g, "") || "string"),
    };
  }
  if (normalized.includes("int")) return { type: "integer" };
  if (normalized.includes("number") || normalized.includes("float")) {
    return { type: "number" };
  }
  if (normalized.includes("bool")) return { type: "boolean" };
  if (normalized.includes("object")) return { type: "object" };
  if (normalized.includes("date-time") || normalized.includes("datetime")) {
    return { type: "string", format: "date-time" };
  }
  if (normalized.includes("date")) return { type: "string", format: "date" };
  if (normalized.includes("uuid")) return { type: "string", format: "uuid" };

  return { type: "string" };
}

export function operationId(endpoint: ExportEndpoint) {
  return endpoint.slug
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) =>
      character.toUpperCase(),
    )
    .replace(/^[^a-zA-Z]+/, "");
}
