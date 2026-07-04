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

/**
 * Generates an OpenAPI document for a public documentation project.
 *
 * @param options - Function options.
 * @param options.project - Project metadata used by the operation.
 * @param options.sections - Published API reference sections to include.
 * @returns Result produced by the function.
 */
export const generateOpenApiDocument = ({
  project,
  sections,
}: {
  project: OpenApiExportProject;
  sections: OpenApiExportSection[];
}) => {
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
};

/**
 * Builds the OpenAPI paths map from documented sections.
 *
 * @param sections - API sections to inspect.
 * @returns OpenAPI paths object.
 */
const paths = (sections: OpenApiExportSection[]) => {
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
};

/**
 * Collects OpenAPI security scheme definitions from endpoints.
 *
 * @param sections - API sections to inspect.
 * @returns OpenAPI security schemes object.
 */
const collectSecuritySchemes = (sections: OpenApiExportSection[]) => {
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
};

/**
 * Builds the OpenAPI security requirement for an endpoint.
 *
 * @param endpoint - Endpoint data used by the helper.
 * @returns OpenAPI security requirement list.
 */
const security = (endpoint: ExportEndpoint) => {
  if (endpoint.body.authHeader.type === "bearer") return [{ BearerAuth: [] }];
  if (endpoint.body.authHeader.type === "basic") return [{ BasicAuth: [] }];
  if (endpoint.body.authHeader.type === "apiKey") return [{ ApiKeyAuth: [] }];
  return undefined;
};

/**
 * Converts a documented field into an OpenAPI parameter object.
 *
 * @param parameter - Parameter field to convert.
 * @returns OpenAPI parameter object.
 */
const openApiParameter = (parameter: ExportField) => {
  return {
    name: parameter.name,
    in: openApiParameterLocation(parameter.location),
    required: parameter.location === "path" ? true : parameter.required,
    description: parameter.description || undefined,
    schema: schemaFromDataType(parameter.dataType),
  };
};

/**
 * Maps a documented parameter location to an OpenAPI location.
 *
 * @param [location] - Parameter location for the fixture.
 * @returns OpenAPI parameter location.
 */
const openApiParameterLocation = (location?: string) => {
  if (location === "path" || location === "query" || location === "header") {
    return location;
  }
  return "query";
};

/**
 * Builds an OpenAPI request body object from documented fields.
 *
 * @param fields - Field definitions to inspect.
 * @returns OpenAPI request body object, or undefined when no fields exist.
 */
const requestBody = (fields: ExportField[]) => {
  if (!fields.length) return undefined;

  return {
    required: fields.some((field) => field.required),
    content: {
      "application/json": {
        schema: objectSchema(fields),
      },
    },
  };
};

/**
 * Builds OpenAPI response objects from documented endpoint samples.
 *
 * @param endpoint - Endpoint data used by the helper.
 * @returns OpenAPI responses object.
 */
const responses = (endpoint: ExportEndpoint) => {
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
};

/**
 * Parses a response example body for OpenAPI output.
 *
 * @param value - Input value to process.
 * @returns Result produced by the function.
 */
export const parseResponseExample = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/**
 * Converts exported fields into a JSON object schema.
 *
 * @param fields - Field definitions to convert.
 * @returns Result produced by the function.
 */
export const objectSchema = (fields: ExportField[]): JsonSchema => {
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
};

/**
 * Converts a single exported field into a JSON schema node.
 *
 * @param field - Field definition to convert.
 * @returns Result produced by the function.
 */
export const schemaFromField = (field: ExportField): JsonSchema => {
  if (field.fields?.length) return objectSchema(field.fields);
  return schemaFromDataType(field.dataType);
};

/**
 * Maps a documented scalar data type to JSON schema.
 *
 * @param dataType - Documented data type label.
 * @returns Result produced by the function.
 */
export const schemaFromDataType = (dataType: string): JsonSchema => {
  const normalized = dataType.trim().toLowerCase();

  if (normalized.includes("array")) {
    return {
      type: "array",
      items: schemaFromDataType(
        normalized.replace(/array|[\[\]<>]/g, "") || "string",
      ),
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
};

/**
 * Builds a stable OpenAPI operationId for a documented endpoint.
 *
 * @param endpoint - Endpoint data used by the operation.
 * @returns Result produced by the function.
 */
export const operationId = (endpoint: ExportEndpoint) => {
  return endpoint.slug
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) =>
      character.toUpperCase(),
    )
    .replace(/^[^a-zA-Z]+/, "");
};
