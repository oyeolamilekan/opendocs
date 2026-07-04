import { describe, expect, it } from "vitest";
import {
  extractPathPlaceholders,
  joinEndpointUrl,
  normalizeEndpointPath,
  syncPathParameters,
  type EndpointParameter,
} from "./endpoint-path";

/**
 * Builds an endpoint parameter fixture for tests.
 *
 * @param name - Name value for the fixture.
 * @param [location="path"] - Parameter location for the fixture.
 * @returns Endpoint parameter fixture.
 */
const parameter = (name: string, location = "path"): EndpointParameter => ({
  name,
  location,
  required: location === "path",
  description: `${name} description`,
  dataType: "string",
});

describe("endpoint path helpers", () => {
  it("normalizes pathnames and joins them to the base URL", () => {
    expect(normalizeEndpointPath(" users//{id}?draft=true ")).toBe(
      "/users/{id}",
    );
    expect(joinEndpointUrl("https://api.example.com/", "users/{id}")).toBe(
      "https://api.example.com/users/{id}",
    );
  });

  it("extracts unique placeholders in path order", () => {
    expect(
      extractPathPlaceholders("/teams/{teamId}/users/{userId}/{teamId}"),
    ).toEqual(["teamId", "userId"]);
  });

  it("creates required path parameters for new placeholders", () => {
    expect(syncPathParameters("/users", "/users/{id}", [])).toEqual([
      {
        name: "id",
        location: "path",
        required: true,
        description: "",
        dataType: "string",
      },
    ]);
  });

  it("preserves metadata when a placeholder is renamed", () => {
    expect(
      syncPathParameters("/users/{id}", "/users/{userId}", [parameter("id")]),
    ).toEqual([
      {
        ...parameter("id"),
        name: "userId",
        required: true,
      },
    ]);
  });

  it("keeps unmatched path parameters and leaves other parameters untouched", () => {
    expect(
      syncPathParameters("/users/{id}", "/users", [
        parameter("id"),
        parameter("page", "query"),
      ]),
    ).toEqual([parameter("id"), parameter("page", "query")]);
  });
});
