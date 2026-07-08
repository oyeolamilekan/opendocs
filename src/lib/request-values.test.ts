import { describe, expect, it } from "vitest";
import {
  coerceRequestValue,
  formatRequestInputValue,
  setNestedRequestValue,
} from "./request-values";

describe("request values", () => {
  it.each([
    ["integer", "42", 42],
    ["integer", "-42", -42],
    ["number", "42.5", 42.5],
    ["number", "42", 42],
    ["boolean", "true", true],
    ["boolean", "false", false],
    ["array<string>", '["admin","developer"]', ["admin", "developer"]],
    ["object", '{"enabled":true}', { enabled: true }],
  ] as const)("coerces %s input to its JSON value", (dataType, value, expected) => {
    expect(coerceRequestValue(dataType, value)).toEqual(expected);
  });

  it("keeps invalid typed input as text while the user is editing", () => {
    expect(coerceRequestValue("integer", "4.2")).toBe("4.2");
    expect(coerceRequestValue("number", "abc")).toBe("abc");
    expect(coerceRequestValue("boolean", "yes")).toBe("yes");
    expect(coerceRequestValue("object", "{")).toBe("{");
  });

  it("stores nested coerced values without mutating the current body", () => {
    const current = { profile: { name: "Ada" } };
    const next = setNestedRequestValue(current, ["profile", "age"], 37);

    expect(next).toEqual({ profile: { name: "Ada", age: 37 } });
    expect(current).toEqual({ profile: { name: "Ada" } });
  });

  it("formats typed values back into input text", () => {
    expect(formatRequestInputValue(42)).toBe("42");
    expect(formatRequestInputValue(true)).toBe("true");
    expect(formatRequestInputValue(["admin"])).toBe('["admin"]');
    expect(formatRequestInputValue(undefined)).toBe("");
  });
});
