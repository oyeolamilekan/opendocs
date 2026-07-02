// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EndpointTester } from "./endpoint-tester";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    _id: "endpoint-id",
    _creationTime: 1,
    projectId: "project-id",
    sectionId: "section-id",
    slug: "get-user",
    title: "Get user",
    endpointType: "endpoint" as const,
    content: undefined,
    markdown: undefined,
    position: 0,
    iconName: undefined,
    updatedAt: 10,
    body: {
      method: "GET" as const,
      path: "/users/{id}",
      description: "Get a user",
      parameters: [],
      requestBody: [],
      authHeader: { type: "none" as const, key: "", value: "" },
      sampleResponses: [],
    },
    ...overrides,
  };
}

function mockFetchResult(result: {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  contentType: string;
}) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("EndpointTester", () => {
  it("does not render the response panel before a response returns", () => {
    render(
      <EndpointTester
        organizationSlug="org"
        projectSlug="project"
        endpoint={mockEndpoint()}
        parameters={{}}
        body={{}}
        credential=""
        onCredentialChange={() => {}}
      />,
    );

    expect(screen.queryByText("Response")).toBeNull();
  });

  it("renders JSON response bodies with syntax highlighting", async () => {
    mockFetchResult({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: { id: "user_123", active: true },
      contentType: "application/json",
    });

    const { container } = render(
      <EndpointTester
        organizationSlug="org"
        projectSlug="project"
        endpoint={mockEndpoint()}
        parameters={{}}
        body={{}}
        credential=""
        onCredentialChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Send Request/i }));

    await waitFor(() =>
      expect(container.querySelector(".code-snippet")).toBeTruthy(),
    );
    expect(container.querySelector(".code-snippet-wrap")).toBeTruthy();
    expect(container.querySelector(".code-token-property")?.textContent).toBe(
      '"id"',
    );
    expect(container.querySelector(".code-token-string")?.textContent).toBe(
      '"user_123"',
    );
    expect(container.querySelector(".code-token-keyword")?.textContent).toBe(
      "true",
    );
  });

  it("renders string response bodies as plain text when content type is not JSON", async () => {
    mockFetchResult({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/plain" },
      body: "Plain text response",
      contentType: "text/plain",
    });

    const { container } = render(
      <EndpointTester
        organizationSlug="org"
        projectSlug="project"
        endpoint={mockEndpoint()}
        parameters={{}}
        body={{}}
        credential=""
        onCredentialChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Send Request/i }));

    await waitFor(() =>
      expect(screen.getByText("Plain text response")).toBeTruthy(),
    );
    expect(container.querySelector(".code-snippet")).toBeTruthy();
  });

  it("renders response headers with JSON syntax highlighting", async () => {
    mockFetchResult({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: {},
      contentType: "application/json",
    });

    const { container } = render(
      <EndpointTester
        organizationSlug="org"
        projectSlug="project"
        endpoint={mockEndpoint()}
        parameters={{}}
        body={{}}
        credential=""
        onCredentialChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Send Request/i }));

    await waitFor(() =>
      expect(screen.getByText("Response Headers")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Response Headers"));

    await waitFor(() =>
      expect(container.querySelectorAll(".code-snippet").length).toBe(2),
    );
  });
});
