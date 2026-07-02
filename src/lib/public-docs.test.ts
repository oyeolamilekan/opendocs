import { describe, expect, it } from "vitest";
import { buildRequestUrl, generateCodeExamples } from "./public-docs";

describe("buildRequestUrl", () => {
  const parameters = [
    { name: "merchantId", location: "path" },
    { name: "search", location: "query" },
  ];

  it("keeps unresolved path placeholders readable", () => {
    expect(
      buildRequestUrl(
        "https://api.example.com/",
        "/merchants/{merchantId}",
        parameters,
        {},
      ),
    ).toBe("https://api.example.com/merchants/{merchantId}");
  });

  it("encodes supplied values without encoding placeholder braces", () => {
    expect(
      buildRequestUrl(
        "https://api.example.com",
        "/merchants/{merchantId}",
        parameters,
        { merchantId: "merchant/a", search: "Ada Lovelace" },
      ),
    ).toBe(
      "https://api.example.com/merchants/merchant%2Fa?search=Ada+Lovelace",
    );
  });
});

describe("generateCodeExamples", () => {
  const examples = generateCodeExamples({
    method: "POST",
    url: "https://api.example.com/v1/users",
    authType: "bearer",
    authKey: "",
    hasBody: true,
    bodyValues: {
      active: true,
      profile: {
        name: "Ada",
        tags: ["admin", "developer"],
      },
    },
  });

  it("formats JavaScript object literals with nested indentation", () => {
    expect(examples.JavaScript).toContain(`  headers: {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
  },`);
    expect(examples.JavaScript).toContain(`  body: JSON.stringify({
    "active": true,
    "profile": {
      "name": "Ada",`);
  });

  it("formats cURL as readable continued arguments", () => {
    expect(examples.cURL).toContain(`curl --request POST \\
  --url 'https://api.example.com/v1/users' \\`);
    expect(examples.cURL).toContain(`  --data '{
    "active": true,`);
  });

  it("uses valid Python literals and indentation", () => {
    expect(examples.Python).toContain(`    json={
        "active": True,
        "profile": {`);
    expect(examples.Python).not.toContain('"active": true');
  });

  it("uses a formatted Ruby hash and multiline request execution", () => {
    expect(examples.Ruby).toContain(`request.body = JSON.generate(
  {
    "active" => true,`);
    expect(examples.Ruby).toContain(`) do |http|
  http.request(request)
end`);
  });

  it.each([
    ["bearer", "X-Access-Token", "Bearer YOUR_TOKEN"],
    ["basic", "X-Credentials", "Basic YOUR_CREDENTIALS"],
    ["apiKey", "x-private-key", "YOUR_API_KEY"],
  ] as const)(
    "uses the configured header key for %s authentication",
    (authType, authKey, placeholder) => {
      const authenticatedExamples = generateCodeExamples({
        method: "GET",
        url: "https://api.example.com/v1/users",
        authType,
        authKey,
        hasBody: false,
      });

      expect(authenticatedExamples.JavaScript).toContain(
        `"${authKey}": "${placeholder}"`,
      );
      expect(authenticatedExamples.cURL).toContain(
        `--header '${authKey}: ${placeholder}'`,
      );
      expect(authenticatedExamples.Python).toContain(
        `"${authKey}": "${placeholder}"`,
      );
      expect(authenticatedExamples.Ruby).toContain(
        `request["${authKey}"] = "${placeholder}"`,
      );
    },
  );

  it.each([
    ["bearer", "X-Access-Token", "sk-test-123", "Bearer sk-test-123"],
    ["basic", "X-Credentials", "dXNlcjpwYXNz", "Basic dXNlcjpwYXNz"],
    ["apiKey", "x-private-key", "key_abc123", "key_abc123"],
  ] as const)(
    "replaces placeholder with credential value for %s authentication",
    (authType, authKey, credential, expectedAuthValue) => {
      const authenticatedExamples = generateCodeExamples({
        method: "GET",
        url: "https://api.example.com/v1/users",
        authType,
        authKey,
        hasBody: false,
        credential,
      });

      expect(authenticatedExamples.JavaScript).toContain(
        `"${authKey}": "${expectedAuthValue}"`,
      );
      expect(authenticatedExamples.cURL).toContain(
        `--header '${authKey}: ${expectedAuthValue}'`,
      );
      expect(authenticatedExamples.Python).toContain(
        `"${authKey}": "${expectedAuthValue}"`,
      );
      expect(authenticatedExamples.Ruby).toContain(
        `request["${authKey}"] = "${expectedAuthValue}"`,
      );
    },
  );
});
