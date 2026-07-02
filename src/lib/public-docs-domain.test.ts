import { describe, expect, it } from "vitest";
import {
  buildPublicDocumentationUrl,
  extractProjectSlugFromHostname,
} from "./public-docs-domain";

describe("public documentation domains", () => {
  it("extracts project slugs from localhost subdomains", () => {
    expect(extractProjectSlugFromHostname("payments.localhost:3000")).toBe(
      "payments",
    );
    expect(extractProjectSlugFromHostname("localhost:3000")).toBeNull();
  });

  it("rejects reserved and nested subdomains", () => {
    expect(extractProjectSlugFromHostname("app.localhost:3000")).toBeNull();
    expect(
      extractProjectSlugFromHostname("nested.payments.localhost:3000"),
    ).toBeNull();
  });

  it("builds localhost public documentation URLs", () => {
    expect(
      buildPublicDocumentationUrl({
        projectSlug: "payments",
        path: "/docs/start",
        protocol: "http",
        host: "localhost:3000",
      }),
    ).toBe("http://payments.localhost:3000/docs/start");
  });

  it("replaces an application subdomain in production", () => {
    expect(
      buildPublicDocumentationUrl({
        projectSlug: "payments",
        path: "/reference/create-charge",
        protocol: "https",
        host: "app.example.com",
      }),
    ).toBe("https://payments.example.com/reference/create-charge");
  });
});
