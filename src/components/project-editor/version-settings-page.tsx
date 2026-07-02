import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { getErrorMessage } from "../../lib/errors";
import { cn } from "../../lib/utils";
import {
  smoothDashboardLinkProps,
  smoothDashboardNavigateOptions,
} from "../dashboard-navigation";
import { ProjectDashboardLoadingPage } from "../project-dashboard-loading-page";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Field, FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { EmptyState } from "../ui/status";
import { useToast } from "../ui/toast";
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ProjectParentNavigation } from "./parent-navigation";
import { selectedDocumentationVersion } from "./helpers";
import type { VersionFlag } from "./types";

export function ProjectVersionSettingsPage({
  organization,
  membership,
  projectSlug,
  versionSlug,
}: {
  organization: Doc<"organizations">;
  membership: Doc<"organizationMembers">;
  projectSlug: string;
  versionSlug: string;
}) {
  const dashboard = useQuery(api.projects.getDashboardBySlug, {
    organizationId: organization._id,
    slug: projectSlug,
  });
  const project = dashboard?.project;
  const versions = dashboard?.versions;
  const selectedVersion = selectedDocumentationVersion(versions, versionSlug);
  const updateVersion = useMutation(api.versions.update);
  const removeVersion = useMutation(api.versions.remove);
  const createVersion = useMutation(api.versions.create);
  const navigate = useNavigate();
  const toast = useToast();
  const [versionSearch, setVersionSearch] = useState("");
  const [renameVersion, setRenameVersion] =
    useState<Doc<"documentationVersions"> | null>(null);
  const [createSourceVersion, setCreateSourceVersion] =
    useState<Doc<"documentationVersions"> | null>(null);
  const [deleteVersion, setDeleteVersion] =
    useState<Doc<"documentationVersions"> | null>(null);
  const [isCreateVersionOpen, setIsCreateVersionOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workingVersionId, setWorkingVersionId] =
    useState<Id<"documentationVersions"> | null>(null);
  const [optimisticVersionFlags, setOptimisticVersionFlags] = useState<
    Record<string, boolean>
  >({});
  const canManage = membership.role === "owner" || membership.role === "admin";

  useEffect(() => {
    if (!versions?.length) return;

    setOptimisticVersionFlags((current) => {
      let changed = false;
      const next = { ...current };

      for (const key of Object.keys(next)) {
        const [versionId, flag] = key.split(":") as [string, VersionFlag];
        const version = versions.find(
          (candidate) => candidate._id === versionId,
        );

        if (version && (version[flag] === true) === next[key]) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [versions]);

  if (dashboard === undefined) {
    return (
      <ProjectDashboardLoadingPage
        kind="version-settings"
        label="Loading version settings"
      />
    );
  }

  if (dashboard === null || !project || !versions || !selectedVersion) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          title="Version Not Found"
          description="The project or version you are looking for does not exist or you do not have access to it."
        />
      </div>
    );
  }

  async function toggleVersionFlag(
    version: Doc<"documentationVersions">,
    flag: VersionFlag,
  ) {
    if (!canManage) return;
    const key = `${version._id}:${flag}`;
    const nextValue = !(optimisticVersionFlags[key] ?? version[flag] === true);

    setOptimisticVersionFlags((current) => ({
      ...current,
      [key]: nextValue,
    }));
    setWorkingVersionId(version._id);

    try {
      await updateVersion({
        versionId: version._id,
        [flag]: nextValue,
      });
    } catch (error) {
      setOptimisticVersionFlags((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      toast.error(getErrorMessage(error, `Unable to update ${flag}`));
    } finally {
      setWorkingVersionId(null);
    }
  }

  async function updateVersionVisibility(
    version: Doc<"documentationVersions">,
    visibility: "default" | "visible" | "hidden",
  ) {
    if (!canManage) return;
    setWorkingVersionId(version._id);

    try {
      if (visibility === "default") {
        await updateVersion({
          versionId: version._id,
          isDefault: true,
        });
        toast.success("Default version updated");
        return;
      }

      await updateVersion({
        versionId: version._id,
        status: visibility === "visible" ? "published" : "draft",
      });
      toast.success(
        visibility === "visible" ? "Version is visible" : "Version is hidden",
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to update version visibility"),
      );
    } finally {
      setWorkingVersionId(null);
    }
  }

  async function submitRenameVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameVersion) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("versionName") ?? "");

    setIsSaving(true);
    try {
      await updateVersion({ versionId: renameVersion._id, name });
      toast.success("Version renamed");
      setRenameVersion(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to rename version"));
    } finally {
      setIsSaving(false);
    }
  }

  async function submitCreateVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("versionName") ?? "");

    setIsCreatingVersion(true);
    try {
      const newVersion = await createVersion({
        projectId: project._id,
        name,
        copyFromVersionId: createSourceVersion?._id,
      });
      toast.success("Version created");
      setIsCreateVersionOpen(false);
      setCreateSourceVersion(null);
      navigate({
        to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
        params: {
          organizationSlug: organization.slug,
          projectSlug,
          versionSlug: newVersion.slug,
        },
        ...smoothDashboardNavigateOptions,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to create version"));
    } finally {
      setIsCreatingVersion(false);
    }
  }

  async function deleteSelectedVersion() {
    if (!deleteVersion || !selectedVersion) return;
    setIsDeleting(true);
    try {
      await removeVersion({ versionId: deleteVersion._id });
      toast.success("Version deleted");
      setDeleteVersion(null);
      if (deleteVersion._id === selectedVersion._id) {
        navigate({
          to: "/app/$organizationSlug/projects/$projectSlug",
          params: { organizationSlug: organization.slug, projectSlug },
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete version"));
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredVersions = versions.filter((version) => {
    const query = versionSearch.trim().toLowerCase();
    return !query || version.name.toLowerCase().includes(query);
  });

  return (
    <>
      <ProjectParentNavigation
        organizationSlug={organization.slug}
        projectSlug={projectSlug}
        projectId={project._id}
        projectTitle={project.title}
        versions={versions}
        selectedVersionSlug={selectedVersion.slug}
        canManage={canManage}
        activeArea="version-settings"
      />

      <div className="dashboard-route-panel app-container py-10">
        <div className="flex flex-wrap items-center gap-4">
          {canManage ? (
            <Button
              variant="secondary"
              className="h-12 rounded-full px-5 text-base"
              onClick={() => {
                setCreateSourceVersion(null);
                setIsCreateVersionOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Version
            </Button>
          ) : null}
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-0 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search"
              value={versionSearch}
              onChange={(event) => setVersionSearch(event.target.value)}
              className="h-12 border-0 bg-transparent pl-9 text-lg shadow-none focus-visible:border-transparent focus-visible:shadow-none"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[60rem] overflow-hidden rounded-md border bg-card">
            <div className="grid grid-cols-[minmax(18rem,2fr)_minmax(7rem,0.55fr)_minmax(7rem,0.45fr)_minmax(9rem,0.65fr)_minmax(11rem,0.75fr)_3rem] items-center border-b bg-muted/50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <div>Version ↑</div>
              <div>Branches</div>
              <div>Beta</div>
              <div>Deprecated</div>
              <div>Visibility</div>
              <div />
            </div>

            {filteredVersions.length === 0 ? (
              <div className="px-5 py-12">
                <EmptyState
                  title="No Versions"
                  description="No documentation versions match your search."
                />
              </div>
            ) : (
              filteredVersions.map((version) => {
                const isWorking = workingVersionId === version._id;
                const isDefault =
                  optimisticVersionFlags[`${version._id}:isDefault`] ??
                  version.isDefault;
                const isBeta =
                  optimisticVersionFlags[`${version._id}:isBeta`] ??
                  version.isBeta;
                const isDeprecated =
                  optimisticVersionFlags[`${version._id}:isDeprecated`] ??
                  version.isDeprecated;
                const visibility = isDefault
                  ? "default"
                  : version.status === "published"
                    ? "visible"
                    : "hidden";

                return (
                  <div
                    key={version._id}
                    className={cn(
                      "grid min-h-16 grid-cols-[minmax(18rem,2fr)_minmax(7rem,0.55fr)_minmax(7rem,0.45fr)_minmax(9rem,0.65fr)_minmax(11rem,0.75fr)_3rem] items-center border-b px-5 py-4 last:border-b-0",
                      version._id === selectedVersion._id && "bg-muted/20",
                    )}
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">
                        {version.name}
                      </h2>
                    </div>
                    <div className="text-muted-foreground">-</div>
                    <div>
                      <VersionFlagSwitch
                        checked={Boolean(isBeta)}
                        disabled={!canManage || isWorking}
                        label={`${isBeta ? "Unmark" : "Mark"} ${version.name} as beta`}
                        onCheckedChange={() =>
                          void toggleVersionFlag(version, "isBeta")
                        }
                      />
                    </div>
                    <div>
                      <VersionFlagSwitch
                        checked={Boolean(isDeprecated)}
                        disabled={!canManage || isWorking}
                        label={`${isDeprecated ? "Restore" : "Deprecate"} ${version.name}`}
                        onCheckedChange={() =>
                          void toggleVersionFlag(version, "isDeprecated")
                        }
                      />
                    </div>
                    <div>
                      <Select
                        value={visibility}
                        disabled={!canManage || isWorking}
                        onValueChange={(nextVisibility) =>
                          void updateVersionVisibility(
                            version,
                            nextVisibility as "default" | "visible" | "hidden",
                          )
                        }
                      >
                        <SelectTrigger className="h-9 border-0 bg-transparent px-0 text-base font-medium capitalize shadow-none focus-visible:shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectGroup>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="visible" disabled={isDefault}>
                              Visible
                            </SelectItem>
                            <SelectItem value="hidden" disabled={isDefault}>
                              Hidden
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end">
                      {canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                disabled={isWorking}
                                onSelect={() => setRenameVersion(version)}
                              >
                                <Pencil />
                                Rename Version
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => setCreateSourceVersion(version)}
                              >
                                <Copy />
                                Duplicate Version
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeleteVersion(version)}
                              >
                                <Trash2 />
                                Delete Version
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button asChild variant="ghost" size="icon-sm">
                          <Link
                            to="/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug"
                            params={{
                              organizationSlug: organization.slug,
                              projectSlug,
                              versionSlug: version.slug,
                            }}
                            aria-label={`Open ${version.name}`}
                            {...smoothDashboardLinkProps}
                          >
                            <ExternalLink />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Modal
        open={renameVersion !== null}
        title="Rename Version"
        onClose={() => setRenameVersion(null)}
      >
        <form onSubmit={submitRenameVersion}>
          <FieldGroup>
            <Field label="Version name" htmlFor="rename-version-name">
              <Input
                id="rename-version-name"
                name="versionName"
                defaultValue={renameVersion?.name}
                autoFocus
                required
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => setRenameVersion(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving Version..." : "Save Version"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>

      <Modal
        open={isCreateVersionOpen}
        title="New Documentation Version"
        description={
          createSourceVersion
            ? `Copy content from ${createSourceVersion.name}.`
            : undefined
        }
        onClose={() => {
          setIsCreateVersionOpen(false);
          setCreateSourceVersion(null);
        }}
      >
        <form onSubmit={submitCreateVersion}>
          <FieldGroup>
            <Field label="Version name" htmlFor="new-version-name">
              <Input
                id="new-version-name"
                name="versionName"
                defaultValue={
                  createSourceVersion
                    ? `${createSourceVersion.name} copy`
                    : undefined
                }
                autoFocus
                disabled={isCreatingVersion}
                required
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateVersionOpen(false);
                  setCreateSourceVersion(null);
                }}
                disabled={isCreatingVersion}
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

      <ConfirmDialog
        open={deleteVersion !== null}
        title="Delete Version"
        description={`Delete ${deleteVersion?.name ?? "this version"} and all pages copied into this version. This cannot be undone.`}
        confirmLabel="Delete Version"
        isConfirming={isDeleting}
        onConfirm={deleteSelectedVersion}
        onClose={() => setDeleteVersion(null)}
      />
    </>
  );
}

function VersionFlagSwitch({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "relative inline-flex h-6 w-10 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-blue-500 bg-blue-500" : "border-border bg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
