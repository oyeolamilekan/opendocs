export function setNestedRequestValue(
  values: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path;
  if (!head) return values;
  if (rest.length === 0) return { ...values, [head]: value };
  const child = isRequestRecord(values[head]) ? values[head] : {};
  return {
    ...values,
    [head]: setNestedRequestValue(child, rest, value),
  };
}

export function coerceRequestValue(dataType: string, value: string): unknown {
  const normalizedType = dataType.trim().toLowerCase();
  const trimmedValue = value.trim();

  if (value === "") return "";

  if (normalizedType === "integer" && /^-?\d+$/.test(trimmedValue)) {
    return Number.parseInt(trimmedValue, 10);
  }

  if (normalizedType === "number" && trimmedValue !== "") {
    const parsed = Number(trimmedValue);
    if (Number.isFinite(parsed)) return parsed;
  }

  if (normalizedType === "boolean") {
    if (trimmedValue.toLowerCase() === "true") return true;
    if (trimmedValue.toLowerCase() === "false") return false;
  }

  if (
    (normalizedType === "object" ||
      normalizedType === "array" ||
      normalizedType.startsWith("array<")) &&
    /^[\[{]/.test(trimmedValue)
  ) {
    try {
      return JSON.parse(trimmedValue);
    } catch {
      return value;
    }
  }

  return value;
}

export function formatRequestInputValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

function isRequestRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
