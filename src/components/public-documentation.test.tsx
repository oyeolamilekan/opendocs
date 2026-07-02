// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DocumentationLink,
  DocumentationTableOfContents,
  GuideDocumentationLink,
  PublicDocumentation,
  ResponseBodyCode,
} from "./public-documentation";
import { ThemeProvider } from "./theme-provider";
import { SidebarProvider } from "./ui/sidebar";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-router", async () => {
  return {
    useRouter: () => ({ navigate: vi.fn() }),
    Link: ({
      to,
      href,
      children,
      ...props
    }: {
      to?: string;
      href?: string;
      children: ReactNode;
    }) => (
      <a href={href ?? to} {...props}>
        {children}
      </a>
    ),
  };
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

function renderWithSidebar(children: ReactNode) {
  return render(<SidebarProvider>{children}</SidebarProvider>);
}

function guideContent(headings: string[]) {
  return JSON.stringify({
    type: "doc",
    content: headings.flatMap((heading) => [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: heading }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: `${heading} content.` }],
      },
    ]),
  });
}

function publicGuideData(content: string) {
  return {
    project: {
      project: {
        title: "Example Docs",
        slug: "example-docs",
        baseUrl: "https://api.example.com",
        description: "Example documentation",
        themeColor: "emerald",
        documentationStyle: "default",
        documentationFont: "sans",
      },
    },
    navigation: [],
    guides: [
      {
        _id: "guide-section",
        title: "Guides",
        slug: "guides",
        position: 0,
        pages: [
          {
            _id: "guide-page",
            title: "Getting Started",
            slug: "getting-started",
            description: "Learn the basics",
            position: 0,
          },
        ],
      },
    ],
    aiSettings: { enabled: false, displayName: "AI Assistant" },
    versions: [
      {
        _id: "version",
        name: "v1.0",
        slug: "v1.0",
        status: "published",
        isDefault: true,
        isBeta: false,
        isDeprecated: false,
        updatedAt: 1,
      },
    ],
    guidePage: {
      title: "Getting Started",
      slug: "getting-started",
      content,
      markdown: "",
      description: "",
      position: 0,
      updatedAt: 1,
    },
  };
}

function publicSearchData() {
  return {
    ...publicGuideData(guideContent(["Overview", "Install SDK"])),
    navigation: [
      {
        _id: "reference-section",
        title: "Wallets",
        slug: "wallets",
        position: 0,
        endpoints: [
          {
            _id: "crypto-fees",
            title: "Get crypto withdrawal fees",
            slug: "get-crypto-withdrawal-fees",
            endpointType: "endpoint" as const,
            method: "GET",
            path: "/withdrawals/fees",
            description: "Get crypto withdrawal fees",
            position: 0,
          },
          {
            _id: "payment-address",
            title: "Create Payment Address for a cryptocurrency",
            slug: "create-payment-address-for-a-cryptocurrency",
            endpointType: "endpoint" as const,
            method: "POST",
            path: "/payment-addresses",
            description: "Create a payment address for a cryptocurrency",
            position: 1,
          },
        ],
      },
    ],
    guides: [
      {
        _id: "guide-section",
        title: "Guides",
        slug: "guides",
        position: 0,
        pages: [
          {
            _id: "supported-assets",
            title: "Supported Crypto Assets",
            slug: "supported-crypto-assets",
            description: "Supported Crypto Assets",
            position: 0,
          },
          {
            _id: "buy-crypto",
            title: "How to buy crypto programmatically",
            slug: "how-to-buy-crypto-programmatically",
            description: "How to buy crypto programmatically",
            position: 1,
          },
        ],
      },
    ],
  };
}

describe("public documentation sidebar links", () => {
  it("renders a guide page icon before the title", () => {
    const { container } = renderWithSidebar(
      <GuideDocumentationLink
        title="Getting Started"
        iconName="rocket"
        isActive={false}
        href="/docs/getting-started"
      />,
    );

    expect(screen.getByText("Getting Started")).toBeTruthy();
    expect(container.querySelector(".lucide-rocket")).toBeTruthy();
  });

  it("renders icons for API doc pages and method badges for endpoints", () => {
    const { container, rerender } = renderWithSidebar(
      <DocumentationLink
        title="Authentication"
        method="GET"
        endpointType="doc"
        iconName="key-round"
        isActive={false}
        href="/reference/authentication"
      />,
    );

    expect(screen.getByText("Authentication")).toBeTruthy();
    expect(screen.getByText("DOC")).toBeTruthy();
    expect(screen.queryByText("GET")).toBeNull();
    expect(container.querySelector(".lucide-key-round")).toBeTruthy();

    rerender(
      <SidebarProvider>
        <DocumentationLink
          title="List Users"
          method="GET"
          endpointType="endpoint"
          iconName="rocket"
          isActive={false}
          href="/reference/list-users"
        />
      </SidebarProvider>,
    );

    expect(screen.getByText("List Users")).toBeTruthy();
    expect(screen.getByText("GET")).toBeTruthy();
    expect(screen.queryByText("DOC")).toBeNull();
    expect(container.querySelector(".lucide-rocket")).toBeNull();
  });
});

describe("public documentation table of contents", () => {
  it("renders the refactored public documentation chrome", () => {
    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={publicGuideData(guideContent(["Overview", "Install SDK"])) as any}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    expect(screen.getByText("v1.0")).toBeTruthy();
    expect(screen.getAllByText("Guides").length).toBeGreaterThan(0);
    expect(screen.getByText("API Reference")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Search documentation" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Jump to/i })).toBeTruthy();
  });

  it("renders custom top navigation links", () => {
    const data = {
      ...publicGuideData(guideContent(["Overview", "Install SDK"])),
      customNavigation: [
        {
          _id: "nav-docs",
          label: "Contact Support",
          href: "/docs/support",
          position: 0,
          isVisible: true,
          openInNewTab: false,
        },
        {
          _id: "nav-keys",
          label: "Get API Keys",
          href: "https://dashboard.example.com/keys",
          position: 1,
          isVisible: true,
          openInNewTab: true,
        },
        {
          _id: "nav-hidden",
          label: "Hidden Link",
          href: "/docs/hidden",
          position: 2,
          isVisible: false,
          openInNewTab: false,
        },
      ],
    };

    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={data as any}
        />
      </ThemeProvider>,
    );

    expect(
      screen
        .getByRole("link", { name: "Contact Support" })
        .getAttribute("href"),
    ).toBe("/docs/support");
    expect(
      screen.getByRole("link", { name: "Get API Keys" }).getAttribute("target"),
    ).toBe("_blank");
    expect(screen.queryByText("Hidden Link")).toBeNull();
  });

  it("opens a responsive search modal from the header trigger", () => {
    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={publicSearchData() as any}
        />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Search documentation" }),
    );

    expect(
      screen.getByRole("searchbox", { name: "Search documentation" }),
    ).toBeTruthy();
    expect(screen.getByText("Start typing to search...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guides" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reference" })).toBeTruthy();
  });

  it("searches across guides and API reference results", () => {
    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={publicSearchData() as any}
        />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Search documentation" }),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search documentation" }),
      { target: { value: "crypto" } },
    );

    expect(
      screen.getByRole("link", { name: "Open Supported Crypto Assets" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open Get crypto withdrawal fees" }),
    ).toBeTruthy();
    expect(screen.getAllByText("GET").length).toBeGreaterThan(0);
  });

  it("filters modal search results by guide and reference tabs", () => {
    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={publicSearchData() as any}
        />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Search documentation" }),
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search documentation" }),
      { target: { value: "crypto" } },
    );

    fireEvent.click(screen.getByRole("button", { name: "Guides" }));
    expect(
      screen.getByRole("link", { name: "Open Supported Crypto Assets" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", {
        name: "Open Get crypto withdrawal fees",
      }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reference" }));
    expect(
      screen.queryByRole("link", { name: "Open Supported Crypto Assets" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open Get crypto withdrawal fees" }),
    ).toBeTruthy();
  });

  it("clears modal search and closes after selecting a result", () => {
    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={publicSearchData() as any}
        />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Search documentation" }),
    );
    const searchbox = screen.getByRole("searchbox", {
      name: "Search documentation",
    });
    fireEvent.change(searchbox, { target: { value: "crypto" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect((searchbox as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Start typing to search...")).toBeTruthy();

    fireEvent.change(searchbox, { target: { value: "crypto" } });
    fireEvent.click(
      screen.getByRole("link", { name: "Open Get crypto withdrawal fees" }),
    );

    expect(
      screen.queryByRole("searchbox", { name: "Search documentation" }),
    ).toBeNull();
  });

  it("renders indented links for guide headings", () => {
    render(
      <DocumentationTableOfContents
        headings={[
          { id: "overview", text: "Overview", level: 2 },
          { id: "install-sdk", text: "Install SDK", level: 3 },
        ]}
      />,
    );

    expect(screen.getByText("On this page")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Overview" }).getAttribute("href"),
    ).toBe("#overview");
    expect(
      screen.getByRole("link", { name: "Install SDK" }).getAttribute("href"),
    ).toBe("#install-sdk");
  });

  it("renders on public guide pages with multiple headings", () => {
    const { container } = render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={
            publicGuideData(guideContent(["Overview", "Install SDK"])) as any
          }
        />
      </ThemeProvider>,
    );

    expect(screen.getAllByText("On this page")).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "Overview" })[0].getAttribute(
        "href",
      ),
    ).toBe("#overview");
    expect(container.querySelector("#overview")).toBeTruthy();
    expect(container.querySelector("#install-sdk")).toBeTruthy();
  });

  it("does not render on public guide pages with fewer than two headings", () => {
    render(
      <ThemeProvider>
        <PublicDocumentation
          organizationSlug="example"
          projectSlug="docs"
          data={publicGuideData(guideContent(["Overview"])) as any}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByText("On this page")).toBeNull();
  });
});

describe("public documentation responses", () => {
  it("renders JSON response bodies with syntax highlighting", () => {
    const { container } = render(
      <ResponseBodyCode code='{"id":"user_123","active":true}' />,
    );

    expect(container.querySelector(".code-snippet")).toBeTruthy();
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

  it("wraps response bodies inside the response panel", () => {
    const { container } = render(
      <ResponseBodyCode code='{"title":"sunt aut facere repellat provident occaecati excepturi optio reprehenderit"}' />,
    );

    expect(container.querySelector(".code-snippet-wrap")).toBeTruthy();
  });
});
