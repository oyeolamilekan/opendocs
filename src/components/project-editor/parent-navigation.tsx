import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { getErrorMessage } from "../../lib/errors";
import {
  smoothDashboardLinkProps,
  smoothDashboardNavigateOptions,
} from "../dashboard-navigation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Field, FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "../ui/select";
import { useToast } from "../ui/toast";
import {
  Activity,
  ArrowLeft,
  BookOpenText,
  Bot,
  Navigation,
  Plus,
  Settings,
  SlidersHorizontal,
  SquareCode,
} from "lucide-react";
import { selectedDocumentationVersion } from "./helpers";
import type { ProjectDocumentationArea } from "./types";

export function ProjectParentNavigation({
  organizationSlug,
  projectSlug,
  projectId,
  projectTitle,
  versions = [],
  selectedVersionSlug,
  canManage = false,
  activeArea,
}: {
  organizationSlug: string;
  projectSlug: string;
  projectId?: Id<"apiProjects">;
  projectTitle: string;
  versions?: Doc<"documentationVersions">[];
  selectedVersionSlug?: string;
  canManage?: boolean;
  activeArea: ProjectDocumentationArea;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const createVersion = useMutation(api.versions.create);
  const [isCreateVersionOpen, setIsCreateVersionOpen] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const selectedVersion = selectedDocumentationVersion(
    versions,
    selectedVersionSlug,
  );
  const routeVersionSlug =
    selectedVersion?.slug ?? selectedVersionSlug ?? "v1-0";

  async function submitCreateVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !selectedVersion) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("versionName") ?? "").trim();
    if (!name) return;

    setIsCreatingVersion(true);
    try {
      const version = await createVersion({
        projectId,
        name,
        copyFromVersionId: selectedVersion._id,
      });
      setIsCreateVersionOpen(false);
      toast.success("Documentation version created");
      await navigate({
        to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
        params: {
          organizationSlug,
          projectSlug,
          versionSlug: version.slug,
        },
        ignoreBlocker: true,
        ...smoothDashboardNavigateOptions,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to create version"));
    } finally {
      setIsCreatingVersion(false);
    }
  }

  return (
    <>
      <div className="hidden w-60 shrink-0 lg:block">
        <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <header className="border-b border-sidebar-border p-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects"
                params={{ organizationSlug }}
                {...smoothDashboardLinkProps}
              >
                <ArrowLeft data-icon="inline-start" />
                Back to Projects
              </Link>
            </Button>
            <div className="px-2 pb-2 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Project
              </p>
              <h1 className="mt-1 truncate font-semibold">{projectTitle}</h1>
              {selectedVersion ? (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    <Select
                      value={selectedVersion.slug}
                      onValueChange={(nextVersionSlug) => {
                        void navigate({
                          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
                          params: {
                            organizationSlug,
                            projectSlug,
                            versionSlug: nextVersionSlug,
                          },
                          ignoreBlocker: true,
                          ...smoothDashboardNavigateOptions,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 min-w-0 flex-1 items-center gap-3 px-3 text-base font-medium">
                        <span className="truncate">{selectedVersion.name}</span>
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        position="popper"
                        className="min-w-72 p-1"
                      >
                        <SelectGroup>
                          {versions.map((version) => (
                            <SelectItem
                              key={version._id}
                              value={version.slug}
                              textValue={version.name}
                              className="min-h-10 rounded-md py-2 pl-3 pr-9 text-sm"
                            >
                              <span className="flex w-full min-w-0 items-center gap-2">
                                <span className="min-w-0 shrink truncate font-semibold">
                                  {version.name}
                                </span>
                                <span className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
                                  {version.isDefault ? (
                                    <Badge
                                      variant="secondary"
                                      className="h-5 rounded-md px-2 text-xs"
                                    >
                                      Default
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant={
                                        version.status === "published"
                                          ? "secondary"
                                          : "outline"
                                      }
                                      className="h-5 rounded-md px-2 text-xs capitalize"
                                    >
                                      {version.status}
                                    </Badge>
                                  )}
                                  {version.isBeta ? (
                                    <Badge
                                      variant="outline"
                                      className="h-5 rounded-md px-2 text-xs"
                                    >
                                      Beta
                                    </Badge>
                                  ) : null}
                                  {version.isDeprecated ? (
                                    <Badge
                                      variant="outline"
                                      className="h-5 rounded-md px-2 text-xs"
                                    >
                                      Deprecated
                                    </Badge>
                                  ) : null}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="size-9"
                        aria-label="Create documentation version"
                        onClick={() => setIsCreateVersionOpen(true)}
                      >
                        <Plus />
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </header>

          <nav
            className="flex flex-col gap-1 overflow-y-auto p-3"
            aria-label="Documentation areas"
          >
            <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Documentation
            </p>
            <Button
              asChild
              variant={activeArea === "guides" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/guides"
                params={{
                  organizationSlug,
                  projectSlug,
                  versionSlug: routeVersionSlug,
                }}
                aria-current={activeArea === "guides" ? "page" : undefined}
                {...smoothDashboardLinkProps}
              >
                <BookOpenText data-icon="inline-start" />
                Guides
              </Link>
            </Button>
            <Button
              asChild
              variant={activeArea === "api-reference" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug"
                params={{
                  organizationSlug,
                  projectSlug,
                  versionSlug: routeVersionSlug,
                }}
                aria-current={
                  activeArea === "api-reference" ? "page" : undefined
                }
                {...smoothDashboardLinkProps}
              >
                <SquareCode data-icon="inline-start" />
                API Reference
              </Link>
            </Button>
            <Button
              asChild
              variant={activeArea === "navigation" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/navigation"
                params={{
                  organizationSlug,
                  projectSlug,
                  versionSlug: routeVersionSlug,
                }}
                aria-current={activeArea === "navigation" ? "page" : undefined}
                {...smoothDashboardLinkProps}
              >
                <Navigation data-icon="inline-start" />
                Navigation
              </Link>
            </Button>
            <Button
              asChild
              variant={activeArea === "metrics" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/metrics"
                params={{ organizationSlug, projectSlug }}
                aria-current={activeArea === "metrics" ? "page" : undefined}
                {...smoothDashboardLinkProps}
              >
                <Activity data-icon="inline-start" />
                Metrics
              </Link>
            </Button>
            <Button
              asChild
              variant={activeArea === "ai" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/ai"
                params={{ organizationSlug, projectSlug }}
                aria-current={activeArea === "ai" ? "page" : undefined}
                {...smoothDashboardLinkProps}
              >
                <Bot data-icon="inline-start" />
                AI
              </Link>
            </Button>
            <Button
              asChild
              variant={
                activeArea === "version-settings" ? "secondary" : "ghost"
              }
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/settings"
                params={{
                  organizationSlug,
                  projectSlug,
                  versionSlug: routeVersionSlug,
                }}
                aria-current={
                  activeArea === "version-settings" ? "page" : undefined
                }
                {...smoothDashboardLinkProps}
              >
                <SlidersHorizontal data-icon="inline-start" />
                Version settings
              </Link>
            </Button>
            <Button
              asChild
              variant={activeArea === "settings" ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <Link
                to="/app/$organizationSlug/projects/$projectSlug/settings"
                params={{ organizationSlug, projectSlug }}
                aria-current={activeArea === "settings" ? "page" : undefined}
                {...smoothDashboardLinkProps}
              >
                <Settings data-icon="inline-start" />
                Settings
              </Link>
            </Button>
          </nav>
        </aside>
      </div>

      <Modal
        open={isCreateVersionOpen}
        title="Create Documentation Version"
        description="Create a new version from the currently selected documentation version."
        onClose={() => {
          if (!isCreatingVersion) setIsCreateVersionOpen(false);
        }}
      >
        <form onSubmit={submitCreateVersion}>
          <FieldGroup>
            <Field label="Version name" htmlFor="version-name">
              <Input
                id="version-name"
                name="versionName"
                defaultValue="v2.0"
                autoFocus
                disabled={isCreatingVersion}
                required
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isCreatingVersion}
                onClick={() => setIsCreateVersionOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingVersion}>
                {isCreatingVersion ? "Creating Version..." : "Create Version"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>
    </>
  );
}
