// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicAiAssistant } from "./public-ai-assistant";

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    setMessages: vi.fn(),
    sendMessage: vi.fn(),
    status: "ready",
    stop: vi.fn(),
    error: null,
  }),
}));

vi.mock("ai", () => ({
  DefaultChatTransport: vi.fn(),
}));

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: storageMock(),
  });
  Object.defineProperty(window, "sessionStorage", {
    writable: true,
    value: storageMock(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PublicAiAssistant", () => {
  it("contains its height within the public documentation viewport", () => {
    render(
      <PublicAiAssistant
        open
        organizationSlug="example"
        projectSlug="docs"
        currentPageTitle="Getting Started"
        currentPagePath="/docs/getting-started"
        displayName="Docs AI"
        onOpenChange={vi.fn()}
      />,
    );

    const assistant = screen
      .getByRole("heading", { name: "Docs AI" })
      .closest("aside");
    const className = assistant?.className ?? "";

    expect(className).toContain("top-[var(--public-doc-header-height)]");
    expect(className).toContain(
      "h-[calc(100svh-var(--public-doc-header-height))]",
    );
    expect(className).toContain("overflow-hidden");
    expect(className).toContain(
      "lg:top-[var(--public-doc-header-height)]",
    );
    expect(className).toContain("lg:self-start");
    expect(className).not.toContain("inset-y-0");
    expect(className).not.toContain("lg:h-svh");
  });
});

function storageMock() {
  const values = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
  };
}
