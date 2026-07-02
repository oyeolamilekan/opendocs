import { useRef, useState, type FormEvent } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  FileUp,
  Globe2,
  Lock,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { smoothDashboardLinkProps } from "../../../components/dashboard-navigation";
import { WorkspaceShell } from "../../../components/workspace-shell";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { Field, FieldGroup } from "../../../components/ui/field";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { EmptyState, LoadingState } from "../../../components/ui/status";
import { Textarea } from "../../../components/ui/textarea";
import { useToast } from "../../../components/ui/toast";
import { getErrorMessage } from "../../../lib/errors";
import {
  DEFAULT_DOCUMENTATION_THEME_COLOR,
  DOCUMENTATION_THEMES,
  getDocumentationTheme,
} from "../../../lib/documentation-theme";

export const Route = createFileRoute("/app/$organizationSlug/projects")({
  component: ProjectsRoute,
});

type Project = Doc<"apiProjects">;
type ProjectFormMode = "create" | "edit";

function ProjectsRoute() {
  const { organizationSlug } = Route.useParams();
  const pathname = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, ""),
  });
  const projectsPath = `/app/${organizationSlug}/projects`;

  if (pathname !== projectsPath) {
    return <Outlet />;
  }

  return (
    <WorkspaceShell organizationSlug={organizationSlug}>
      {(workspace) => <Projects workspace={workspace} />}
    </WorkspaceShell>
  );
}

function Projects({
  workspace,
}: {
  workspace: {
    organization: Doc<"organizations">;
    membership: Doc<"organizationMembers">;
  };
}) {
  const projects = useQuery(api.projects.list, {
    organizationId: workspace.organization._id,
  });
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const importSpecification = useAction(api.openapi.importSpecification);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [formMode, setFormMode] = useState<ProjectFormMode | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [importProject, setImportProject] = useState<Project | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const canManage =
    workspace.membership.role === "owner" ||
    workspace.membership.role === "admin";
  const isEditingProject = formMode === "edit";

  const visibleProjects = projects?.filter((project) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      project.title.toLowerCase().includes(query) ||
      project.baseUrl.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query)
    );
  });

  function closeProjectForm() {
    if (isWorking) return;
    setFormMode(null);
    setSelectedProject(null);
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "");
    const baseUrl = String(form.get("baseUrl") ?? "");
    const description = String(form.get("description") ?? "");
    const visibility =
      form.get("visibility") === "public" ? "public" : "private";
    const themeColor = getDocumentationTheme(
      String(form.get("themeColor") ?? ""),
    ).value;

    setIsWorking(true);
    try {
      if (formMode === "edit" && selectedProject) {
        await updateProject({
          projectId: selectedProject._id,
          title,
          baseUrl,
          description,
          visibility,
          themeColor,
        });
        toast.success("Project updated");
      } else {
        await createProject({
          organizationId: workspace.organization._id,
          title,
          baseUrl,
          description,
          visibility,
          themeColor,
        });
        toast.success("Project created");
      }
      setFormMode(null);
      setSelectedProject(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save project"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmDelete() {
    if (!deleteProject) return;
    setIsWorking(true);
    try {
      await removeProject({ projectId: deleteProject._id });
      toast.success("Project deleted");
      setDeleteProject(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete project"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmImport() {
    if (!importProject || !importFile) return;
    const extension = importFile.name.split(".").pop()?.toLowerCase();
    const format = extension === "json" ? "json" : "yaml";
    setIsWorking(true);
    try {
      const result = await importSpecification({
        projectId: importProject._id,
        content: await importFile.text(),
        format,
      });
      toast.success(
        `Imported ${result.endpointCount} endpoints in ${result.sectionCount} sections`,
      );
      setImportProject(null);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to import specification"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
      <div className="dashboard-route-panel app-container py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted-foreground">
              {workspace.organization.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              Projects
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Build and publish API references for this organization.
            </p>
          </div>
          {canManage ? (
            <Button
              onClick={() => {
                setSelectedProject(null);
                setFormMode("create");
              }}
            >
              <Plus className="size-4" />
              New Project
            </Button>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {projects === undefined ? (
          <div className="mt-8">
            <LoadingState label="Loading projects" />
          </div>
        ) : visibleProjects?.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={search ? "No Matching Projects" : "No Projects Yet"}
              description={
                search
                  ? "Try another title, base URL, or description."
                  : canManage
                    ? "Create a project or import an OpenAPI specification to begin."
                    : "An owner or admin must create the first project."
              }
              action={
                !search && canManage ? (
                  <Button onClick={() => setFormMode("create")}>
                    <Plus className="size-4" />
                    Create Project
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleProjects?.map((project) => (
              <Card key={project._id} className="min-h-72">
                <CardHeader>
                  <Badge
                    variant={
                      project.visibility === "public" ? "default" : "secondary"
                    }
                  >
                    {project.visibility === "public" ? <Globe2 /> : <Lock />}
                    {project.visibility}
                  </Badge>
                  {canManage ? (
                    <CardAction>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${project.title}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onSelect={() => {
                                setSelectedProject(project);
                                setFormMode("edit");
                              }}
                            >
                              <Pencil /> Edit Project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setDeleteProject(project)}
                            >
                              <Trash2 /> Delete Project
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardAction>
                  ) : null}
                  <CardTitle className="mt-4 text-xl">
                    {project.title}
                  </CardTitle>
                  <CardDescription className="truncate font-mono text-xs">
                    {project.baseUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {project.description}
                  </p>
                </CardContent>
                <CardFooter className="mt-auto justify-between gap-3">
                  <Button asChild variant="link" className="px-0">
                    <Link
                      to="/app/$organizationSlug/projects/$projectSlug"
                      params={{
                        organizationSlug: workspace.organization.slug,
                        projectSlug: project.slug,
                      }}
                      {...smoothDashboardLinkProps}
                    >
                      Open Editor
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                  {canManage ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setImportProject(project);
                        setImportFile(null);
                      }}
                    >
                      <FileUp data-icon="inline-start" />
                      Import
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={formMode !== null}
        title={isEditingProject ? "Update Project" : "Create Project"}
        description={
          isEditingProject
            ? "Update the project details shown across the editor and public documentation."
            : "Add the basic details for a new documentation project."
        }
        onClose={closeProjectForm}
      >
        <form onSubmit={submitProject}>
          <FieldGroup>
            <Field label="Title" htmlFor="project-title">
              <Input
                id="project-title"
                name="title"
                defaultValue={selectedProject?.title}
                placeholder="API documentation"
                required
              />
            </Field>
            <Field label="Base URL" htmlFor="project-base-url">
              <Input
                id="project-base-url"
                name="baseUrl"
                type="url"
                defaultValue={selectedProject?.baseUrl}
                placeholder="https://api.example.com"
                required
              />
            </Field>
            <Field label="Description" htmlFor="project-description">
              <Textarea
                id="project-description"
                name="description"
                defaultValue={selectedProject?.description}
                placeholder="Short description of the API"
              />
            </Field>
            <Field label="Visibility" htmlFor="project-visibility">
              <Select
                name="visibility"
                defaultValue={selectedProject?.visibility ?? "private"}
              >
                <SelectTrigger id="project-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="private">
                      <span className="flex items-center gap-2">
                        <Lock className="size-3.5" /> Private
                      </span>
                    </SelectItem>
                    <SelectItem value="public">
                      <span className="flex items-center gap-2">
                        <Globe2 className="size-3.5" /> Public
                      </span>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Theme color" htmlFor="project-theme-color">
              <Select
                name="themeColor"
                defaultValue={
                  selectedProject?.themeColor ??
                  DEFAULT_DOCUMENTATION_THEME_COLOR
                }
              >
                <SelectTrigger id="project-theme-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DOCUMENTATION_THEMES.map((theme) => (
                      <SelectItem key={theme.value} value={theme.value}>
                        <span className="flex items-center gap-2">
                          <Palette
                            className="size-3.5"
                            style={{ color: theme.primary }}
                          />
                          {theme.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isWorking}
                onClick={closeProjectForm}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isWorking}>
                {isWorking
                  ? isEditingProject
                    ? "Updating Project..."
                    : "Creating Project..."
                  : isEditingProject
                    ? "Update Project"
                    : "Create Project"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>

      <Modal
        open={importProject !== null}
        title="Import OpenAPI specification"
        description="JSON, YAML, and YML files up to 1 MiB are supported."
        onClose={() => {
          setImportProject(null);
          setImportFile(null);
        }}
      >
        <div className="flex flex-col gap-5">
          <Alert variant="destructive">
            <FileUp />
            <AlertTitle>Existing documentation will be replaced</AlertTitle>
            <AlertDescription>
              Importing replaces every section and endpoint in{" "}
              <strong>{importProject?.title}</strong>. This cannot be undone.
            </AlertDescription>
          </Alert>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
            onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
          />
          <Button
            className="w-full"
            disabled={!importFile || isWorking}
            onClick={confirmImport}
          >
            <FileUp data-icon="inline-start" />
            {isWorking ? "Importing..." : "Replace and import"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteProject !== null}
        title="Delete Project"
        description="This permanently deletes the project, all sections, and every endpoint."
        confirmLabel="Delete Project"
        isConfirming={isWorking}
        onConfirm={confirmDelete}
        onClose={() => setDeleteProject(null)}
      />
    </>
  );
}
