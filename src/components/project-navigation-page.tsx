import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  Navigation,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { getErrorMessage } from "../lib/errors";
import { smoothDashboardLinkProps } from "./dashboard-navigation";
import { ProjectDashboardLoadingPage } from "./project-dashboard-loading-page";
import { ProjectParentNavigation } from "./project-editor";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { ConfirmDialog } from "./ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Field, FieldGroup } from "./ui/field";
import { Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { EmptyState } from "./ui/status";
import { ThemeToggle } from "./theme-toggle";
import { useToast } from "./ui/toast";

type NavigationDashboard = NonNullable<
  ReturnType<typeof useQuery<typeof api.documentationNavigation.getDashboardBySlug>>
>;
type NavigationItem = NavigationDashboard["items"][number];

type NavigationFormState = {
  label: string;
  href: string;
  isVisible: boolean;
  openInNewTab: boolean;
};

const emptyFormState: NavigationFormState = {
  label: "",
  href: "",
  isVisible: true,
  openInNewTab: false,
};

export function ProjectNavigationPage({
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
  const dashboard = useQuery(api.documentationNavigation.getDashboardBySlug, {
    organizationId: organization._id,
    projectSlug,
    versionSlug,
  });
  const createItem = useMutation(api.documentationNavigation.create);
  const updateItem = useMutation(api.documentationNavigation.update);
  const reorderItems = useMutation(api.documentationNavigation.reorder);
  const removeItem = useMutation(api.documentationNavigation.remove);
  const toast = useToast();
  const [editingItem, setEditingItem] = useState<NavigationItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<NavigationItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workingItemId, setWorkingItemId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<NavigationFormState>(emptyFormState);
  const canManage = membership.role === "owner" || membership.role === "admin";

  if (dashboard === undefined) {
    return (
      <ProjectDashboardLoadingPage
        kind="navigation"
        label="Loading navigation"
      />
    );
  }

  if (dashboard === null) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          title="Navigation Not Found"
          description="The project or version you are looking for does not exist or you do not have access to it."
        />
      </div>
    );
  }

  const { project, versions, selectedVersion } = dashboard;
  const items = [...dashboard.items].sort(
    (left, right) => left.position - right.position,
  );

  function openCreateModal() {
    setFormState(emptyFormState);
    setIsCreateOpen(true);
  }

  function openEditModal(item: NavigationItem) {
    setFormState({
      label: item.label,
      href: item.href,
      isVisible: item.isVisible,
      openInNewTab: item.openInNewTab,
    });
    setEditingItem(item);
  }

  function closeModal() {
    if (isSaving) return;
    setIsCreateOpen(false);
    setEditingItem(null);
    setFormState(emptyFormState);
  }

  async function submitNavigationItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateItem({
          itemId: editingItem._id,
          ...formState,
        });
        toast.success("Navigation link updated");
      } else {
        await createItem({
          projectId: project._id,
          versionId: selectedVersion._id,
          ...formState,
        });
        toast.success("Navigation link added");
      }
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save navigation link"));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleItemVisibility(item: NavigationItem) {
    if (!canManage) return;
    setWorkingItemId(item._id);
    try {
      await updateItem({
        itemId: item._id,
        isVisible: !item.isVisible,
      });
      toast.success(item.isVisible ? "Link hidden" : "Link visible");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update visibility"));
    } finally {
      setWorkingItemId(null);
    }
  }

  async function moveItem(item: NavigationItem, direction: -1 | 1) {
    if (!canManage) return;
    const currentIndex = items.findIndex((candidate) => candidate._id === item._id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);
    setWorkingItemId(item._id);

    try {
      await reorderItems({
        projectId: project._id,
        versionId: selectedVersion._id,
        itemIds: nextItems.map((candidate) => candidate._id),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to reorder navigation"));
    } finally {
      setWorkingItemId(null);
    }
  }

  async function deleteSelectedItem() {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      await removeItem({ itemId: deleteItem._id });
      toast.success("Navigation link deleted");
      setDeleteItem(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete navigation link"));
    } finally {
      setIsDeleting(false);
    }
  }

  const modalTitle = editingItem ? "Edit Navigation Link" : "Add Navigation Link";

  return (
    <div className="project-editor-shell flex min-h-svh w-full overflow-x-hidden bg-sidebar text-foreground">
      <ProjectParentNavigation
        organizationSlug={organization.slug}
        projectSlug={project.slug}
        projectId={project._id}
        projectTitle={project.title}
        versions={versions}
        selectedVersionSlug={selectedVersion.slug}
        canManage={canManage}
        activeArea="navigation"
      />
      <SidebarProvider className="min-w-0 flex-1 overflow-x-hidden">
        <SidebarInset className="min-w-0 bg-background">
          <header className="sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
            <SidebarTrigger className="lg:hidden" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link
                      to="/app/$organizationSlug/projects"
                      params={{ organizationSlug: organization.slug }}
                      {...smoothDashboardLinkProps}
                    >
                      {organization.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:list-item" />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      to="/app/$organizationSlug/projects/$projectSlug"
                      params={{
                        organizationSlug: organization.slug,
                        projectSlug: project.slug,
                      }}
                      {...smoothDashboardLinkProps}
                    >
                      {project.title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Navigation</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ThemeToggle className="ml-auto" />
          </header>

          <main className="dashboard-route-panel app-container py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-2">
                <Badge variant="secondary" className="w-fit">
                  <Navigation />
                  {selectedVersion.name}
                </Badge>
                <h1 className="text-3xl font-semibold tracking-[-0.04em]">
                  Custom navigation
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Add the version-specific links shown in the public
                  documentation top menu.
                </p>
              </div>
              {canManage ? (
                <Button onClick={openCreateModal} className="w-full sm:w-fit">
                  <Plus data-icon="inline-start" />
                  Add Link
                </Button>
              ) : null}
            </div>

            {!canManage ? (
              <Alert className="mt-8">
                <Navigation />
                <AlertTitle>View-only access</AlertTitle>
                <AlertDescription>
                  Only owners and admins can change custom navigation.
                </AlertDescription>
              </Alert>
            ) : null}

            <Card className="mt-8 overflow-hidden border-border/80 bg-card/95">
              <CardHeader className="border-b">
                <CardTitle>Top menu links</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {items.length ? (
                  <div className="divide-y">
                    {items.map((item, index) => {
                      const isWorking = workingItemId === item._id;
                      const isExternal = /^https?:\/\//i.test(item.href);

                      return (
                        <div
                          key={item._id}
                          className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_3rem]"
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate font-semibold">
                                {item.label}
                              </p>
                              {!item.isVisible ? (
                                <Badge variant="outline">Hidden</Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                              {isExternal ? (
                                <ExternalLink className="size-3.5 shrink-0" />
                              ) : null}
                              <span className="truncate">{item.href}</span>
                            </div>
                          </div>
                          <div className="hidden text-sm text-muted-foreground sm:block">
                            {item.openInNewTab && isExternal
                              ? "New tab"
                              : "Same tab"}
                          </div>
                          <div className="hidden items-center gap-1 sm:flex">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={!canManage || isWorking || index === 0}
                              aria-label={`Move ${item.label} up`}
                              onClick={() => void moveItem(item, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={
                                !canManage ||
                                isWorking ||
                                index === items.length - 1
                              }
                              aria-label={`Move ${item.label} down`}
                              onClick={() => void moveItem(item, 1)}
                            >
                              <ArrowDown />
                            </Button>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={!canManage || isWorking}
                                aria-label={`Actions for ${item.label}`}
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => openEditModal(item)}
                                >
                                  <Pencil />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void toggleItemVisibility(item)}
                                >
                                  {item.isVisible ? <EyeOff /> : <Eye />}
                                  {item.isVisible ? "Hide" : "Show"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={index === 0}
                                  onClick={() => void moveItem(item, -1)}
                                >
                                  <ArrowUp />
                                  Move up
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={index === items.length - 1}
                                  onClick={() => void moveItem(item, 1)}
                                >
                                  <ArrowDown />
                                  Move down
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteItem(item)}
                                >
                                  <Trash2 />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-14">
                    <EmptyState
                      title="No Navigation Links"
                      description="Add links to show a custom top menu in this version of the public documentation."
                      action={
                        canManage ? (
                          <Button onClick={openCreateModal}>
                            <Plus data-icon="inline-start" />
                            Add Link
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </SidebarProvider>

      <Modal
        open={isCreateOpen || editingItem !== null}
        title={modalTitle}
        description="Configure a link for the public documentation top menu."
        onClose={closeModal}
      >
        <form onSubmit={submitNavigationItem}>
          <FieldGroup>
            <Field label="Label" htmlFor="navigation-label">
              <Input
                id="navigation-label"
                value={formState.label}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                maxLength={80}
                disabled={isSaving}
                autoFocus
                required
              />
            </Field>
            <Field
              label="URL or path"
              htmlFor="navigation-href"
              hint="Use https://example.com or /docs/getting-started"
            >
              <Input
                id="navigation-href"
                value={formState.href}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    href: event.target.value,
                  }))
                }
                maxLength={300}
                placeholder="/docs/getting-started"
                disabled={isSaving}
                required
              />
            </Field>
            <div className="rounded-lg border bg-background p-4">
              <label className="flex items-start gap-3">
                <Checkbox
                  checked={formState.isVisible}
                  disabled={isSaving}
                  onCheckedChange={(checked) =>
                    setFormState((current) => ({
                      ...current,
                      isVisible: checked === true,
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    Show in public documentation
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Hidden links stay saved here but are not shown to readers.
                  </span>
                </span>
              </label>
              <label className="mt-4 flex items-start gap-3">
                <Checkbox
                  checked={formState.openInNewTab}
                  disabled={isSaving}
                  onCheckedChange={(checked) =>
                    setFormState((current) => ({
                      ...current,
                      openInNewTab: checked === true,
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    Open external URLs in a new tab
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Internal documentation paths stay in the current tab.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={closeModal}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !canManage}>
                {isSaving ? "Saving..." : editingItem ? "Save Link" : "Add Link"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteItem !== null}
        title="Delete Navigation Link"
        description={`This permanently deletes "${deleteItem?.label ?? ""}" from the ${selectedVersion.name} top menu.`}
        confirmLabel="Delete Link"
        isConfirming={isDeleting}
        onConfirm={() => void deleteSelectedItem()}
        onClose={() => setDeleteItem(null)}
      />
    </div>
  );
}
