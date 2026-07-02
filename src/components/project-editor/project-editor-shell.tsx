import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  Link,
  useBlocker as useTanStackBlocker,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  smoothDashboardLinkProps,
  smoothDashboardNavigateOptions,
} from "../dashboard-navigation";
import { getErrorMessage } from "../../lib/errors";
import { buildBrowserPublicDocumentationUrl } from "../../lib/public-docs-domain";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Field, FieldGroup } from "../ui/field";
import { Input } from "../ui/input";
import { Modal } from "../ui/modal";
import { EmptyState, LoadingState } from "../ui/status";
import { ProjectDashboardLoadingPage } from "../project-dashboard-loading-page";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "../ui/sidebar";
import { useToast } from "../ui/toast";
import { ThemeToggle } from "../theme-toggle";
import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  Lock,
  Plus,
  Save,
} from "lucide-react";
import { EMPTY_DOC_JSON, selectedDocumentationVersion } from "./helpers";
import { useEndpointDraft, useGuidePageDraft } from "./use-drafts";
import { ProjectParentNavigation } from "./parent-navigation";
import { GuideSectionSidebarList, SectionSidebarList } from "./sidebar-lists";
import { EndpointEditor } from "./endpoint-editor";
import { GuidePageEditor } from "./guide-page-editor";
import type {
  EditableProjectDocumentationArea,
  GuideSectionItem,
  Navigation,
} from "./types";

export function ProjectEditor({
  organization,
  membership,
  projectSlug,
  versionSlug,
  endpointSlug,
  guideSlug,
  area = "api-reference",
}: {
  organization: Doc<"organizations">;
  membership: Doc<"organizationMembers">;
  projectSlug: string;
  versionSlug?: string;
  endpointSlug?: string;
  guideSlug?: string;
  area?: EditableProjectDocumentationArea;
}) {
  const dashboard = useQuery(api.projects.getDashboardBySlug, {
    organizationId: organization._id,
    slug: projectSlug,
  });
  const project = dashboard?.project;
  const versions = dashboard?.versions;
  const ensureDefaultVersion = useMutation(api.versions.ensureDefault);
  const navigation = useQuery(
    api.sections.navigation,
    project && versions !== undefined
      ? {
          projectId: project._id,
          versionId: selectedDocumentationVersion(versions, versionSlug)?._id,
        }
      : "skip",
  );
  const guideNavigation = useQuery(
    api.guides.navigation,
    project && versions !== undefined
      ? {
          projectId: project._id,
          versionId: selectedDocumentationVersion(versions, versionSlug)?._id,
        }
      : "skip",
  );
  const endpoint = useQuery(
    api.endpoints.getBySlug,
    project && versions !== undefined && endpointSlug
      ? {
          projectId: project._id,
          versionId: selectedDocumentationVersion(versions, versionSlug)?._id,
          slug: endpointSlug,
        }
      : "skip",
  );
  const guidePage = useQuery(
    api.guides.getBySlug,
    project && versions !== undefined && guideSlug
      ? {
          projectId: project._id,
          versionId: selectedDocumentationVersion(versions, versionSlug)?._id,
          slug: guideSlug,
        }
      : "skip",
  );
  const navigate = useNavigate();
  const toast = useToast();
  const createSection = useMutation(api.sections.create);
  const updateSection = useMutation(api.sections.update);
  const removeSection = useMutation(api.sections.remove);
  const createEndpoint = useMutation(api.endpoints.create);
  const updateEndpoint = useMutation(api.endpoints.update);
  const removeEndpoint = useMutation(api.endpoints.remove);
  const createGuidePage = useMutation(api.guides.create);
  const updateGuidePage = useMutation(api.guides.update);
  const removeGuidePage = useMutation(api.guides.remove);
  const createGuideSection = useMutation(api.guideSections.create);
  const updateGuideSection = useMutation(api.guideSections.update);
  const removeGuideSection = useMutation(api.guideSections.remove);
  const updateProject = useMutation(api.projects.update);
  const [sectionModal, setSectionModal] = useState<{
    mode: "create" | "edit";
    section?: Navigation[number];
  } | null>(null);
  const [guideSectionModal, setGuideSectionModal] = useState<{
    mode: "create" | "edit";
    section?: GuideSectionItem;
  } | null>(null);
  const [creatingSectionId, setCreatingSectionId] =
    useState<Id<"apiSections"> | null>(null);
  const [deleteSection, setDeleteSection] = useState<Navigation[number] | null>(
    null,
  );
  const [deleteEndpoint, setDeleteEndpoint] = useState<Pick<
    Doc<"apiEndpoints">,
    "_id" | "title"
  > | null>(null);
  const [deleteGuidePage, setDeleteGuidePage] = useState<Pick<
    Doc<"guidePages">,
    "_id" | "title"
  > | null>(null);
  const [deleteGuideSection, setDeleteGuideSection] =
    useState<GuideSectionItem | null>(null);
  const [creatingGuideSectionId, setCreatingGuideSectionId] =
    useState<Id<"guideSections"> | null>(null);
  const [isReferenceSidebarOpen, setIsReferenceSidebarOpen] = useState(true);
  const { draft, setDraft, savedDraft, setSavedDraft } = useEndpointDraft(
    endpoint,
    endpointSlug,
  );
  const {
    draft: guideDraft,
    setDraft: setGuideDraft,
    savedDraft: savedGuideDraft,
    setSavedDraft: setSavedGuideDraft,
  } = useGuidePageDraft(guidePage, guideSlug);
  const [isWorking, setIsWorking] = useState(false);
  const canManage = membership.role === "owner" || membership.role === "admin";
  const selectedVersion = selectedDocumentationVersion(versions, versionSlug);
  const isEndpointDraftDirty = Boolean(
    draft && JSON.stringify(draft) !== savedDraft,
  );
  const isGuideDraftDirty = Boolean(
    guideDraft && JSON.stringify(guideDraft) !== savedGuideDraft,
  );

  const blocker = useTanStackBlocker(
    () => isEndpointDraftDirty || isGuideDraftDirty,
  );
  useEffect(() => {
    if (blocker.status === "blocked" && blocker.proceed && blocker.reset) {
      const confirmed = window.confirm(
        "You have unsaved changes. Leave without saving?",
      );
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    async function ensureVersion() {
      if (!project || !versions || versions.length > 0) return;
      await ensureDefaultVersion({ projectId: project._id });
    }
    void ensureVersion();
  }, [project, versions, ensureDefaultVersion]);

  async function submitSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !selectedVersion) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("sectionTitle") ?? "");

    setIsWorking(true);
    try {
      if (sectionModal?.mode === "edit" && sectionModal.section) {
        await updateSection({
          sectionId: sectionModal.section._id,
          title,
        });
        toast.success("Section renamed");
      } else {
        const newSection = await createSection({
          projectId: project._id,
          versionId: selectedVersion._id,
          title,
        });
        toast.success("Section created");
        if (newSection) {
          setCreatingSectionId(newSection._id);
          window.setTimeout(() => setCreatingSectionId(null), 600);
        }
      }
      setSectionModal(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save section"));
    } finally {
      setIsWorking(false);
    }
  }

  async function submitGuideSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !selectedVersion) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("sectionTitle") ?? "");

    setIsWorking(true);
    try {
      if (guideSectionModal?.mode === "edit" && guideSectionModal.section) {
        await updateGuideSection({
          sectionId: guideSectionModal.section._id,
          title,
        });
        toast.success("Guide section renamed");
      } else {
        const newSection = await createGuideSection({
          projectId: project._id,
          versionId: selectedVersion._id,
          title,
        });
        toast.success("Guide section created");
        if (newSection) {
          setCreatingGuideSectionId(newSection._id);
          window.setTimeout(() => setCreatingGuideSectionId(null), 600);
        }
      }
      setGuideSectionModal(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save guide section"));
    } finally {
      setIsWorking(false);
    }
  }

  async function createDocument(sectionId: Id<"apiSections">) {
    if (!project || !selectedVersion) return;
    setIsWorking(true);
    try {
      const newEndpoint = await createEndpoint({
        projectId: project._id,
        sectionId,
        title: "Untitled document",
        endpointType: "doc",
        content: EMPTY_DOC_JSON,
        markdown: "",
      });
      if (!newEndpoint) return;
      navigate({
        to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/reference/$endpointSlug",
        params: {
          organizationSlug: organization.slug,
          projectSlug,
          versionSlug: selectedVersion.slug,
          endpointSlug: newEndpoint.slug,
        },
        ...smoothDashboardNavigateOptions,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to create document"));
    } finally {
      setIsWorking(false);
    }
  }

  async function createGuideDocument(sectionId: Id<"guideSections">) {
    if (!project || !selectedVersion) return;
    setIsWorking(true);
    try {
      const newPage = await createGuidePage({
        projectId: project._id,
        sectionId,
        title: "Untitled page",
        content: EMPTY_DOC_JSON,
        markdown: "",
      });
      if (!newPage) return;
      navigate({
        to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/guides/$guideSlug",
        params: {
          organizationSlug: organization.slug,
          projectSlug,
          versionSlug: selectedVersion.slug,
          guideSlug: newPage.slug,
        },
        ...smoothDashboardNavigateOptions,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to create guide page"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveEndpointDraft() {
    if (!draft || !endpoint) return;
    setIsWorking(true);
    try {
      const updatedEndpoint = await updateEndpoint({
        endpointId: endpoint._id,
        sectionId: draft.sectionId,
        title: draft.title,
        endpointType: draft.endpointType,
        content: draft.content,
        markdown: draft.markdown,
        iconName:
          draft.endpointType === "doc" ? (draft.iconName ?? "") : undefined,
        body: draft.body,
      });
      toast.success("Endpoint updated");
      setSavedDraft(JSON.stringify(draft));
      if (updatedEndpoint?.slug && updatedEndpoint.slug !== endpointSlug) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/reference/$endpointSlug",
          params: {
            organizationSlug: organization.slug,
            projectSlug,
            versionSlug: selectedVersion?.slug ?? versionSlug ?? "v1-0",
            endpointSlug: updatedEndpoint.slug,
          },
          ignoreBlocker: true,
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save endpoint"));
    } finally {
      setIsWorking(false);
    }
  }

  async function saveGuidePageDraft() {
    if (!guideDraft || !guidePage) return;
    setIsWorking(true);
    try {
      const updatedGuidePage = await updateGuidePage({
        guidePageId: guidePage._id,
        title: guideDraft.title,
        content: guideDraft.content,
        markdown: guideDraft.markdown,
        description: guideDraft.body.description,
        iconName: guideDraft.iconName ?? "",
      });
      toast.success("Guide page updated");
      setSavedGuideDraft(JSON.stringify(guideDraft));
      if (updatedGuidePage?.slug && updatedGuidePage.slug !== guideSlug) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/guides/$guideSlug",
          params: {
            organizationSlug: organization.slug,
            projectSlug,
            versionSlug: selectedVersion?.slug ?? versionSlug ?? "v1-0",
            guideSlug: updatedGuidePage.slug,
          },
          ignoreBlocker: true,
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save guide page"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmDeleteSection() {
    if (!deleteSection) return;
    setIsWorking(true);
    try {
      await removeSection({ sectionId: deleteSection._id });
      toast.success("Section deleted");
      setDeleteSection(null);
      if (
        endpointSlug &&
        navigation?.some(
          (section) =>
            section._id === deleteSection._id &&
            section.endpoints.some((item) => item.slug === endpointSlug),
        )
      ) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
          params: {
            organizationSlug: organization.slug,
            projectSlug,
            versionSlug: selectedVersion?.slug ?? versionSlug ?? "v1-0",
          },
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete section"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmDeleteEndpoint() {
    if (!deleteEndpoint) return;
    setIsWorking(true);
    try {
      await removeEndpoint({ endpointId: deleteEndpoint._id });
      toast.success("Endpoint deleted");
      setDeleteEndpoint(null);
      if (endpointSlug) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
          params: {
            organizationSlug: organization.slug,
            projectSlug,
            versionSlug: selectedVersion?.slug ?? versionSlug ?? "v1-0",
          },
          ignoreBlocker: true,
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete endpoint"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmDeleteGuidePage() {
    if (!deleteGuidePage) return;
    setIsWorking(true);
    try {
      await removeGuidePage({ guidePageId: deleteGuidePage._id });
      toast.success("Guide page deleted");
      setDeleteGuidePage(null);
      if (guideSlug) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
          params: {
            organizationSlug: organization.slug,
            projectSlug,
            versionSlug: selectedVersion?.slug ?? versionSlug ?? "v1-0",
          },
          ignoreBlocker: true,
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete guide page"));
    } finally {
      setIsWorking(false);
    }
  }

  async function confirmDeleteGuideSection() {
    if (!deleteGuideSection) return;
    setIsWorking(true);
    try {
      await removeGuideSection({ sectionId: deleteGuideSection._id });
      toast.success("Guide section deleted");
      setDeleteGuideSection(null);
      if (
        guideSlug &&
        guideNavigation?.some(
          (section) =>
            section._id === deleteGuideSection._id &&
            section.pages.some((page) => page.slug === guideSlug),
        )
      ) {
        await navigate({
          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug",
          params: {
            organizationSlug: organization.slug,
            projectSlug,
            versionSlug: selectedVersion?.slug ?? versionSlug ?? "v1-0",
          },
          ...smoothDashboardNavigateOptions,
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete guide section"));
    } finally {
      setIsWorking(false);
    }
  }

  async function toggleVisibility() {
    if (!project) return;
    try {
      await updateProject({
        projectId: project._id,
        visibility: project.visibility === "public" ? "private" : "public",
      });
      toast.success(
        project.visibility === "public"
          ? "Project is now private"
          : "Project is now public",
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update visibility"));
    }
  }

  if (dashboard === undefined) {
    return (
      <ProjectDashboardLoadingPage
        kind={area === "guides" ? "guides" : "api-reference"}
        label="Loading project editor"
      />
    );
  }

  if (dashboard === null || !project) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <EmptyState
          title="Project Not Found"
          description="The project you are looking for does not exist or you do not have access to it."
        />
      </div>
    );
  }

  const publicUrl = buildBrowserPublicDocumentationUrl(projectSlug);
  const isDocument = area === "guides";

  return (
    <>
      <div className="project-editor-shell flex min-h-svh w-full overflow-x-hidden bg-sidebar text-foreground">
        <ProjectParentNavigation
          organizationSlug={organization.slug}
          projectSlug={projectSlug}
          projectId={project._id}
          projectTitle={project.title}
          versions={versions ?? []}
          selectedVersionSlug={selectedVersion?.slug}
          canManage={canManage}
          activeArea={area}
        />

        <SidebarProvider
          className="min-w-0 flex-1 overflow-x-hidden"
          open={isReferenceSidebarOpen}
          onOpenChange={setIsReferenceSidebarOpen}
          style={{ "--sidebar-width": "19rem" } as CSSProperties}
        >
          <Sidebar
            collapsible="offcanvas"
            className="project-documentation-sidebar border-r lg:left-60!"
          >
            <SidebarHeader className="project-documentation-sidebar-header project-editor-sidebar-header border-b border-sidebar-border">
              <div className="project-editor-sidebar-titlebar">
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link
                    to="/app/$organizationSlug/projects"
                    params={{ organizationSlug: organization.slug }}
                    {...smoothDashboardLinkProps}
                  >
                    <ArrowLeft />
                  </Link>
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {project.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedVersion?.name ?? "v1.0"}
                  </p>
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className="project-documentation-sidebar-content">
              {isDocument ? (
                <SidebarGroup>
                  <div className="project-documentation-menu-heading">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Guides
                    </span>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Add Section"
                        title="Add Section"
                        onClick={() => setGuideSectionModal({ mode: "create" })}
                      >
                        <Plus />
                      </Button>
                    ) : null}
                  </div>
                  {guideNavigation?.length === 0 ? (
                    <div className="px-3">
                      <EmptyState
                        title="No Sections"
                        description="Add a section to begin writing guides."
                        action={
                          canManage ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                setGuideSectionModal({ mode: "create" })
                              }
                            >
                              <Plus className="size-3.5" />
                              Add Section
                            </Button>
                          ) : undefined
                        }
                      />
                    </div>
                  ) : (
                    <GuideSectionSidebarList
                      sections={guideNavigation ?? []}
                      activeGuideSlug={guideSlug}
                      creatingSectionId={creatingGuideSectionId}
                      canManage={canManage}
                      onAddPage={createGuideDocument}
                      onDeleteSection={setDeleteGuideSection}
                      onDeleteGuidePage={setDeleteGuidePage}
                      onRename={(section) =>
                        setGuideSectionModal({ mode: "edit", section })
                      }
                      onSelectGuidePage={async (slug) => {
                        await navigate({
                          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/guides/$guideSlug",
                          params: {
                            organizationSlug: organization.slug,
                            projectSlug,
                            versionSlug:
                              selectedVersion?.slug ?? versionSlug ?? "v1-0",
                            guideSlug: slug,
                          },
                          ...smoothDashboardNavigateOptions,
                        });
                      }}
                      onReorderGuidePages={async () => {}}
                      onMoveGuidePage={async () => {}}
                    />
                  )}
                </SidebarGroup>
              ) : (
                <SidebarGroup>
                  <div className="project-documentation-menu-heading">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      API Reference
                    </span>
                    {canManage ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Add Section"
                        title="Add Section"
                        onClick={() => setSectionModal({ mode: "create" })}
                      >
                        <Plus />
                      </Button>
                    ) : null}
                  </div>
                  {navigation?.length === 0 ? (
                    <div className="px-3">
                      <EmptyState
                        title="No Sections"
                        description="Add a section to begin documenting endpoints."
                        action={
                          canManage ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                setSectionModal({ mode: "create" })
                              }
                            >
                              <Plus className="size-3.5" />
                              Add Section
                            </Button>
                          ) : undefined
                        }
                      />
                    </div>
                  ) : (
                    <SectionSidebarList
                      sections={navigation ?? []}
                      activeEndpointSlug={endpointSlug}
                      creatingSectionId={creatingSectionId}
                      canManage={canManage}
                      onAddPage={createDocument}
                      onDeleteSection={setDeleteSection}
                      onDeleteEndpoint={setDeleteEndpoint}
                      onReorderSections={async () => {}}
                      onReorderEndpoints={async () => {}}
                      onMoveEndpoint={async () => {}}
                      onRename={(section) =>
                        setSectionModal({ mode: "edit", section })
                      }
                      onSelectEndpoint={async (slug) => {
                        await navigate({
                          to: "/app/$organizationSlug/projects/$projectSlug/versions/$versionSlug/reference/$endpointSlug",
                          params: {
                            organizationSlug: organization.slug,
                            projectSlug,
                            versionSlug:
                              selectedVersion?.slug ?? versionSlug ?? "v1-0",
                            endpointSlug: slug,
                          },
                          ...smoothDashboardNavigateOptions,
                        });
                      }}
                    />
                  )}
                </SidebarGroup>
              )}
            </SidebarContent>

            <SidebarFooter className="border-t p-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    View Docs
                  </a>
                </Button>
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={toggleVisibility}
                  >
                    {project.visibility === "public" ? (
                      <>
                        <Lock className="size-3.5" /> Make Private
                      </>
                    ) : (
                      <>
                        <Globe2 className="size-3.5" /> Make Public
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
            <div className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
              <SidebarTrigger />
              <ThemeToggle className="ml-auto" />
            </div>

            <main className="dashboard-route-panel min-w-0 p-6 lg:p-8">
              {isDocument ? (
                guideSlug ? (
                  guidePage === undefined ? (
                    <LoadingState label="Loading guide page" />
                  ) : guidePage === null ? (
                    <EmptyState
                      title="Guide Page Not Found"
                      description="The guide page you are looking for does not exist."
                    />
                  ) : guideDraft ? (
                    <>
                      {canManage ? (
                        <div className="mx-auto mb-4 flex w-full max-w-[90rem] justify-end">
                          <Button
                            onClick={saveGuidePageDraft}
                            disabled={isWorking || !isGuideDraftDirty}
                          >
                            <Save data-icon="inline-start" />
                            {isWorking ? "Saving..." : "Save changes"}
                          </Button>
                        </div>
                      ) : null}
                      <GuidePageEditor
                        projectId={project._id}
                        draft={guideDraft}
                        canManage={canManage}
                        onChange={(nextDraft) => setGuideDraft(nextDraft)}
                        onDelete={() =>
                          setDeleteGuidePage({
                            _id: guidePage._id,
                            title: guidePage.title,
                          })
                        }
                      />
                    </>
                  ) : (
                    <EmptyState
                      title="Guide Page Unavailable"
                      description="This guide page could not be loaded."
                    />
                  )
                ) : (
                  <EmptyState
                    title="Create a Guide Page"
                    description="Select or create a guide page from the sidebar to begin writing."
                  />
                )
              ) : endpointSlug ? (
                endpoint === undefined ? (
                  <LoadingState label="Loading endpoint" />
                ) : endpoint === null ? (
                  <EmptyState
                    title="Endpoint Not Found"
                    description="The endpoint you are looking for does not exist."
                  />
                ) : draft ? (
                  <>
                    {canManage ? (
                      <div className="mx-auto mb-4 flex w-full max-w-[90rem] justify-end">
                        <Button
                          onClick={saveEndpointDraft}
                          disabled={isWorking || !isEndpointDraftDirty}
                        >
                          <Save data-icon="inline-start" />
                          {isWorking ? "Saving..." : "Save changes"}
                        </Button>
                      </div>
                    ) : null}
                    <EndpointEditor
                      projectId={project._id}
                      baseUrl={project.baseUrl}
                      draft={draft}
                      navigation={navigation ?? []}
                      canManage={canManage}
                      onChange={(nextDraft) => setDraft(nextDraft)}
                      onDelete={() =>
                        setDeleteEndpoint({
                          _id: endpoint._id,
                          title: endpoint.title,
                        })
                      }
                    />
                  </>
                ) : (
                  <EmptyState
                    title="Endpoint Unavailable"
                    description="This endpoint could not be loaded."
                  />
                )
              ) : (
                <EmptyState
                  title="Build the Reference"
                  description="Select or create an endpoint or guide page from the sidebar to begin editing."
                />
              )}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>

      <Modal
        open={sectionModal !== null}
        title={
          sectionModal?.mode === "edit" ? "Rename Section" : "Create Section"
        }
        onClose={() => setSectionModal(null)}
      >
        <form onSubmit={submitSection}>
          <FieldGroup>
            <Field label="Section title" htmlFor="section-title">
              <Input
                id="section-title"
                name="sectionTitle"
                defaultValue={sectionModal?.section?.title}
                autoFocus
                required
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isWorking}
                onClick={() => setSectionModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isWorking}>
                {isWorking ? "Saving..." : "Save Section"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>

      <Modal
        open={guideSectionModal !== null}
        title={
          guideSectionModal?.mode === "edit"
            ? "Rename Guide Section"
            : "Create Guide Section"
        }
        onClose={() => setGuideSectionModal(null)}
      >
        <form onSubmit={submitGuideSection}>
          <FieldGroup>
            <Field label="Section title" htmlFor="guide-section-title">
              <Input
                id="guide-section-title"
                name="sectionTitle"
                defaultValue={guideSectionModal?.section?.title}
                autoFocus
                required
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isWorking}
                onClick={() => setGuideSectionModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isWorking}>
                {isWorking ? "Saving..." : "Save Section"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteSection !== null}
        title="Delete Section"
        description={`This permanently deletes "${deleteSection?.title ?? ""}" and every endpoint inside it.`}
        confirmLabel="Delete Section"
        isConfirming={isWorking}
        onConfirm={confirmDeleteSection}
        onClose={() => setDeleteSection(null)}
      />
      <ConfirmDialog
        open={deleteEndpoint !== null}
        title="Delete Endpoint"
        description={`This permanently deletes "${deleteEndpoint?.title ?? ""}". The section and project remain available.`}
        confirmLabel="Delete Endpoint"
        isConfirming={isWorking}
        onConfirm={confirmDeleteEndpoint}
        onClose={() => setDeleteEndpoint(null)}
      />
      <ConfirmDialog
        open={deleteGuidePage !== null}
        title="Delete Page"
        description={`This permanently deletes "${deleteGuidePage?.title ?? ""}". The project remains available.`}
        confirmLabel="Delete Page"
        isConfirming={isWorking}
        onConfirm={confirmDeleteGuidePage}
        onClose={() => setDeleteGuidePage(null)}
      />
      <ConfirmDialog
        open={deleteGuideSection !== null}
        title="Delete Guide Section"
        description={`This permanently deletes "${deleteGuideSection?.title ?? ""}" and every page inside it.`}
        confirmLabel="Delete Section"
        isConfirming={isWorking}
        onConfirm={confirmDeleteGuideSection}
        onClose={() => setDeleteGuideSection(null)}
      />
    </>
  );
}
