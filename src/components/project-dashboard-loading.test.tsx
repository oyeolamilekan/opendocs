// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ProjectDashboardLoadingPage } from "./project-dashboard-loading-page";
import { ProjectAiPage } from "./project-ai-page";
import { ProjectSettingsPage } from "./project-settings-page";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({
    results: [],
    status: "LoadingFirstPage",
    loadMore: vi.fn(),
  }),
  useQuery: () => undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    children: ReactNode;
    to?: string;
  }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const organization: Doc<"organizations"> = {
  _id: "organization-id" as Id<"organizations">,
  _creationTime: 1,
  name: "Example Org",
  slug: "example-org",
  createdBy: "profile-id" as Id<"userProfiles">,
  updatedAt: 1,
};

const membership: Doc<"organizationMembers"> = {
  _id: "membership-id" as Id<"organizationMembers">,
  _creationTime: 1,
  organizationId: organization._id,
  userProfileId: "profile-id" as Id<"userProfiles">,
  role: "owner",
  status: "active",
  updatedAt: 1,
};

describe("project dashboard loading pages", () => {
  it("shows a complete loading state for settings", () => {
    render(
      <ProjectSettingsPage
        organization={organization}
        membership={membership}
        projectSlug="example-project"
      />,
    );

    expect(screen.getByText("Loading settings page")).toBeTruthy();
  });

  it("shows a complete loading state for AI", () => {
    render(
      <ProjectAiPage
        organization={organization}
        membership={membership}
        projectSlug="example-project"
      />,
    );

    expect(screen.getByText("Loading AI page")).toBeTruthy();
  });

  it("supports the other project dashboard loading contexts", () => {
    render(
      <ProjectDashboardLoadingPage
        kind="metrics"
        label="Loading metrics"
      />,
    );

    expect(screen.getByText("Loading metrics")).toBeTruthy();

    cleanup();

    render(
      <ProjectDashboardLoadingPage
        kind="version-settings"
        label="Loading version settings"
      />,
    );

    expect(screen.getByText("Loading version settings")).toBeTruthy();
  });
});
