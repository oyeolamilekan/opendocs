// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

  it("keeps the panel variant out of its own scroll area", () => {
    const { container } = render(
      <EndpointTester
        organizationSlug="org"
        projectSlug="project"
        endpoint={mockEndpoint()}
        parameters={{}}
        body={{}}
        credential=""
        onCredentialChange={() => {}}
        variant="panel"
      />,
    );

    expect(container.firstElementChild?.className).toBe("min-w-0");
    expect(container.firstElementChild?.className).not.toContain(
      "overflow-y-auto",
    );
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
    expect(screen.getByText("200")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Headers/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy response" })).toBeTruthy();
    expect(
      screen
        .getByTestId("response-body-scroll")
        .className.includes("max-h-[clamp(10rem,29svh,19rem)]"),
    ).toBe(true);
    expect(
      screen.getByTestId("response-body-scroll").className.includes(" h-["),
    ).toBe(false);
    expect(
      screen
        .getByTestId("response-body-scroll")
        .className.includes("rounded-b-lg"),
    ).toBe(true);
    expect(container.querySelector(".code-snippet-wrap")).toBeNull();
    expect(container.querySelector(".lucide-chevron-down")).toBeNull();
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

  it("opens a responsive headers modal with response and request headers", async () => {
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
      expect(screen.getByRole("button", { name: /Headers/i })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Headers/i }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Headers" }),
    ).toBeTruthy();
    expect(within(dialog).getByText("Response")).toBeTruthy();
    expect(within(dialog).getByText("Request")).toBeTruthy();
    expect(within(dialog).getByText("content-type")).toBeTruthy();
    expect(within(dialog).getAllByText("application/json").length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getByText("accept")).toBeTruthy();
    expect(
      within(dialog).getAllByRole("button", { name: "Close" }).length,
    ).toBeGreaterThan(0);
    expect(container.querySelectorAll(".code-snippet").length).toBe(1);
  });

  it("copies the formatted response body", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockFetchResult({
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      body: { id: "user_123", active: true },
      contentType: "application/json",
    });

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

    fireEvent.click(screen.getByRole("button", { name: /Send Request/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copy response" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy response" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify({ id: "user_123", active: true }, null, 2),
      ),
    );
  });
});
