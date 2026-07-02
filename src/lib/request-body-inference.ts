const MAX_RAW_JSON_LENGTH = 256 * 1024;
const MAX_FIELDS = 500;
const MAX_OBJECT_DEPTH = 5;

export type InferredRequestBodyField = {
  name: string;
  dataType: string;
  required: boolean;
  description: string;
  fields?: InferredRequestBodyField[];
};

export type RequestBodyInferenceResult =
  | { ok: true; fields: InferredRequestBodyField[] }
  | { ok: false; error: string };

type InferenceContext = {
  fieldCount: number;
};

export function inferRequestBodyFields(
  rawJson: string,
): RequestBodyInferenceResult {
  if (!rawJson.trim()) {
    return { ok: false, error: "Paste a JSON object to import." };
  }

  if (rawJson.length > MAX_RAW_JSON_LENGTH) {
    return {
      ok: false,
      error: "The JSON body must be 256 KiB or smaller.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (error) {
    const detail =
      error instanceof SyntaxError
        ? error.message.replace(/^JSON Parse error:\s*/i, "")
        : "The value could not be parsed.";
    return { ok: false, error: `Enter valid JSON: ${detail}` };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: "The request body must be a top-level JSON object.",
    };
  }

  try {
    const context: InferenceContext = { fieldCount: 0 };
    return {
      ok: true,
      fields: inferObjectFields(parsed, context, 0),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The request body could not be converted.",
    };
  }
}

function inferObjectFields(
  value: Record<string, unknown>,
  context: InferenceContext,
  objectDepth: number,
) {
  return Object.entries(value).map(([name, fieldValue]) => {
    context.fieldCount += 1;
    if (context.fieldCount > MAX_FIELDS) {
      throw new Error(`Request bodies may contain at most ${MAX_FIELDS} fields.`);
    }

    const inferred = inferValue(fieldValue, context, objectDepth);
    return {
      name,
      dataType: inferred.dataType,
      required: false,
      description: "",
      ...(inferred.fields ? { fields: inferred.fields } : {}),
    };
  });
}

function inferValue(
  value: unknown,
  context: InferenceContext,
  objectDepth: number,
): {
  dataType: string;
  fields?: InferredRequestBodyField[];
} {
  if (value === null) return { dataType: "unknown" };
  if (typeof value === "string") return { dataType: "string" };
  if (typeof value === "boolean") return { dataType: "boolean" };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Request body numbers must be finite.");
    }
    return { dataType: Number.isInteger(value) ? "integer" : "number" };
  }
  if (Array.isArray(value)) {
    return { dataType: inferArrayType(value) };
  }
  if (isRecord(value)) {
    const nextDepth = objectDepth + 1;
    if (nextDepth > MAX_OBJECT_DEPTH) {
      throw new Error(
        `Nested objects may be at most ${MAX_OBJECT_DEPTH} levels deep.`,
      );
    }
    return {
      dataType: "object",
      fields: inferObjectFields(value, context, nextDepth),
    };
  }

  return { dataType: "unknown" };
}

function inferArrayType(values: unknown[]) {
  if (values.length === 0) return "array";

  const itemTypes = values.map(scalarArrayItemType);
  if (itemTypes.some((type) => type === null)) return "array";

  const distinctTypes = new Set(itemTypes);
  if (distinctTypes.size === 1) {
    return `array<${itemTypes[0]}>`;
  }
  if (
    distinctTypes.size === 2 &&
    distinctTypes.has("integer") &&
    distinctTypes.has("number")
  ) {
    return "array<number>";
  }

  return "array";
}

function scalarArrayItemType(value: unknown) {
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
