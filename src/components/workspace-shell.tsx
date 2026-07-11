import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { authClient } from "../lib/auth-client";
import { resetAuthCache } from "../lib/auth-cache";
import { RequireAuth } from "./auth/auth-gates";
import { smoothDashboardLinkProps } from "./dashboard-navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Separator } from "./ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar";
import { LoadingState } from "./ui/status";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { ThemeToggle } from "./theme-toggle";

export function WorkspaceShell({
  organizationSlug,
  children,
  layout = "default",
}: {
  organizationSlug: string;
  children: (workspace: {
    organization: Doc<"organizations">;
    membership: Doc<"organizationMembers">;
  }) => ReactNode;
  layout?: "default" | "none";
}) {
  return (
    <RequireAuth>
      <WorkspaceShellContent
        organizationSlug={organizationSlug}
        layout={layout}
      >
        {children}
      </WorkspaceShellContent>
    </RequireAuth>
  );
}

function WorkspaceShellContent({
  organizationSlug,
  children,
  layout,
}: {
  organizationSlug: string;
  children: Parameters<typeof WorkspaceShell>[0]["children"];
  layout: NonNullable<Parameters<typeof WorkspaceShell>[0]["layout"]>;
}) {
  const memberships = useQuery(api.organizations.listMine);
  const navigate = useNavigate();
  const selected = memberships?.[0];

  useEffect(() => {
    if (!memberships) return;

    if (!selected) {
      void navigate({ to: "/onboarding", replace: true });
      return;
    }

    if (selected.organization.slug !== organizationSlug) {
      void navigate({
        to: "/app/$organizationSlug/projects",
        params: { organizationSlug: selected.organization.slug },
        replace: true,
      });
    }
  }, [memberships, navigate, organizationSlug, selected]);

  async function signOut() {
    resetAuthCache();
    await authClient.signOut();
    await navigate({ to: "/", replace: true });
  }

  if (
    !memberships ||
    !selected ||
    selected.organization.slug !== organizationSlug
  ) {
    return <WorkspaceLoadingShell />;
  }

  if (layout === "none") {
    return children(selected);
  }

  return (
    <SidebarProvider>
      <WorkspaceSidebar workspace={selected} onSignOut={signOut} />
      <SidebarInset>
        <WorkspaceHeader
          organizationName={selected.organization.name}
          organizationSlug={organizationSlug}
        />
        {children(selected)}
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceLoadingShell() {
  return (
    <div className="flex min-h-svh w-full overflow-hidden bg-sidebar text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="space-y-4 p-4">
          <div className="h-8 w-32 animate-pulse rounded-md bg-sidebar-accent" />
          <div className="space-y-2 pt-3">
            <div className="h-3 w-16 animate-pulse rounded bg-sidebar-accent" />
            <div className="h-5 w-40 animate-pulse rounded bg-sidebar-accent" />
          </div>
          <div className="space-y-2 pt-4">
            <div className="h-9 w-full animate-pulse rounded-md bg-sidebar-accent" />
            <div className="h-9 w-full animate-pulse rounded-md bg-sidebar-accent/70" />
            <div className="h-9 w-full animate-pulse rounded-md bg-sidebar-accent/70" />
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-14 shrink-0 items-center border-b px-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-8 w-8 animate-pulse rounded-full bg-muted" />
        </header>
        <div className="flex flex-1 items-center justify-center px-5">
          <LoadingState label="Restoring workspace" />
        </div>
      </main>
    </div>
  );
}

function WorkspaceHeader({
  organizationName,
  organizationSlug,
}: {
  organizationName: string;
  organizationSlug: string;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isSettings = pathname.includes("/settings");

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
      />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:inline-flex">
            <BreadcrumbLink asChild>
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug }}
                {...smoothDashboardLinkProps}
              >
                {organizationName}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:list-item" />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {isSettings ? "Organization settings" : "Projects"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <ThemeToggle className="ml-auto" />
    </header>
  );
}
