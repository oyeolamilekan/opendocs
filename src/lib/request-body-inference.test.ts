import { describe, expect, it } from "vitest";
import { inferRequestBodyFields } from "./request-body-inference";

describe("inferRequestBodyFields", () => {
  it.each(["", "   "])("rejects empty input", (input) => {
    expect(inferRequestBodyFields(input)).toEqual({
      ok: false,
      error: "Paste a JSON object to import.",
    });
  });

  it("rejects malformed JSON", () => {
    const result = inferRequestBodyFields('{"email":');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Enter valid JSON:");
  });

  it.each(["[]", '"text"', "42", "true", "null"])(
    "rejects a non-object root: %s",
    (input) => {
      expect(inferRequestBodyFields(input)).toEqual({
        ok: false,
        error: "The request body must be a top-level JSON object.",
      });
    },
  );

  it("infers scalar and null field types", () => {
    expect(
      inferRequestBodyFields(
        JSON.stringify({
          name: "Ada",
          active: true,
          retries: 3,
          ratio: 1.5,
          metadata: null,
        }),
      ),
    ).toEqual({
      ok: true,
      fields: [
        field("name", "string"),
        field("active", "boolean"),
        field("retries", "integer"),
        field("ratio", "number"),
        field("metadata", "unknown"),
      ],
    });
  });

  it("infers nested objects without marking fields required", () => {
    expect(
      inferRequestBodyFields(
        JSON.stringify({
          profile: {
            first_name: "Ada",
            address: { city: "Lagos" },
          },
        }),
      ),
    ).toEqual({
      ok: true,
      fields: [
        {
          ...field("profile", "object"),
          fields: [
            field("first_name", "string"),
            {
              ...field("address", "object"),
              fields: [field("city", "string")],
            },
          ],
        },
      ],
    });
  });

  it("accepts five nested object levels", () => {
    const value = nestedObject(5);
    expect(inferRequestBodyFields(JSON.stringify(value)).ok).toBe(true);
  });

  it("rejects more than five nested object levels", () => {
    const result = inferRequestBodyFields(JSON.stringify(nestedObject(6)));
    expect(result).toEqual({
      ok: false,
      error: "Nested objects may be at most 5 levels deep.",
    });
  });

  it.each([
    [["a", "b"], "array<string>"],
    [[true, false], "array<boolean>"],
    [[1, 2], "array<integer>"],
    [[1.5, 2.5], "array<number>"],
    [[1, 2.5], "array<number>"],
    [[], "array"],
    [[1, "two"], "array"],
    [[{ id: 1 }], "array"],
    [[[1]], "array"],
    [[null, null], "array"],
  ] as const)("infers array %j as %s", (value, dataType) => {
    expect(inferRequestBodyFields(JSON.stringify({ values: value }))).toEqual({
      ok: true,
      fields: [field("values", dataType)],
    });
  });

  it("accepts 500 fields", () => {
    const value = Object.fromEntries(
      Array.from({ length: 500 }, (_, index) => [`field_${index}`, index]),
    );
    const result = inferRequestBodyFields(JSON.stringify(value));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fields).toHaveLength(500);
  });

  it("rejects 501 fields", () => {
    const value = Object.fromEntries(
      Array.from({ length: 501 }, (_, index) => [`field_${index}`, index]),
    );
    expect(inferRequestBodyFields(JSON.stringify(value))).toEqual({
      ok: false,
      error: "Request bodies may contain at most 500 fields.",
    });
  });

  it("rejects oversized input", () => {
    const input = JSON.stringify({ value: "a".repeat(256 * 1024) });
    expect(inferRequestBodyFields(input)).toEqual({
      ok: false,
      error: "The JSON body must be 256 KiB or smaller.",
    });
  });

  it("does not mutate parsed input", () => {
    const input = { profile: { name: "Ada" } };
    const before = structuredClone(input);
    inferRequestBodyFields(JSON.stringify(input));
    expect(input).toEqual(before);
  });
});

function field(name: string, dataType: string) {
  return {
    name,
    dataType,
    required: false,
    description: "",
  };
}

function nestedObject(depth: number): Record<string, unknown> {
  let value: Record<string, unknown> = { leaf: "value" };
  for (let index = 0; index < depth; index += 1) {
    value = { [`level_${index}`]: value };
  }
  return value;
}
