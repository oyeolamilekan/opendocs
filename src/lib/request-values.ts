export function setNestedRequestValue(
  values: Record<string, unknown>,
  path: string[],
  value: string,
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

function isRequestRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
