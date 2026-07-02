import { describe, expect, it } from "vitest";
import { formatCode } from "./code-snippet";

describe("formatCode", () => {
  it("removes surrounding blank lines and shared indentation", () => {
    expect(
      formatCode(`
        const response = await fetch("/users", {
          method: "GET"
        });
      `),
    ).toBe(`const response = await fetch("/users", {
  method: "GET"
});`);
  });

  it("normalizes line endings, tabs, and trailing whitespace", () => {
    expect(formatCode("\r\n\tcurl https://api.example.com  \r\n")).toBe(
      "curl https://api.example.com",
    );
  });
});
