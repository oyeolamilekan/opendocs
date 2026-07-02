import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  FolderKanban,
  LogOut,
  PanelsTopLeft,
  Settings,
} from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { smoothDashboardLinkProps } from "./dashboard-navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";

type Workspace = {
  organization: Doc<"organizations">;
  membership: Doc<"organizationMembers">;
};

export function WorkspaceSidebar({
  workspace,
  onSignOut,
}: {
  workspace: Workspace;
  onSignOut: () => Promise<void>;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { setOpenMobile } = useSidebar();
  const organizationSlug = workspace.organization.slug;
  const projectsPath = `/app/${organizationSlug}/projects`;
  const settingsPath = `/app/${organizationSlug}/settings`;

  function closeMobileSidebar() {
    setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Minialdoc">
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug }}
                onClick={closeMobileSidebar}
                {...smoothDashboardLinkProps}
              >
                <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <PanelsTopLeft />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Minialdoc</span>
                  <span className="truncate text-xs">API documentation</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={workspace.organization.name}
            >
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug }}
                onClick={closeMobileSidebar}
                {...smoothDashboardLinkProps}
              >
                <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground">
                  <Building2 />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {workspace.organization.name}
                  </span>
                  <span className="truncate text-xs capitalize">
                    {workspace.membership.role}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(projectsPath)}
                  tooltip="Projects"
                >
                  <Link
                    to="/app/$organizationSlug/projects"
                    params={{ organizationSlug }}
                    onClick={closeMobileSidebar}
                    {...smoothDashboardLinkProps}
                  >
                    <FolderKanban />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(settingsPath)}
                  tooltip="Settings"
                >
                  <Link
                    to="/app/$organizationSlug/settings"
                    params={{ organizationSlug }}
                    onClick={closeMobileSidebar}
                    {...smoothDashboardLinkProps}
                  >
                    <Settings />
                    <span>Organization settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign Out">
              <button type="button" onClick={onSignOut}>
                <LogOut />
                <span>Sign Out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
