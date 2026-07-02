import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import {
  FileCode2,
  FileText,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { DocumentationIcon } from "../../lib/documentation-icons";
import { reorderEndpointItems, reorderSectionItems } from "./helpers";
import type {
  EndpointItem,
  GuideNavigation,
  GuidePageItem,
  GuideSectionItem,
  Navigation,
  SectionItem,
} from "./types";

type EndpointDrag = {
  pointerId: number;
  sourceIndex: number;
  startX: number;
  startY: number;
  previewOffsetY: number;
  listElement: HTMLElement;
  targetListElement?: HTMLElement;
  targetIndex?: number;
  targetIndicatorElement?: HTMLElement;
  started: boolean;
};

type EndpointDropPosition = {
  index: number;
  edge: "before" | "after";
};
type SectionDrag = EndpointDrag;
type SectionDropPosition = EndpointDropPosition;

const ENDPOINT_OPTIMISTIC_MOVE_EVENT = "endpoint-optimistic-move";
const GUIDE_OPTIMISTIC_MOVE_EVENT = "guide-optimistic-move";

type OptimisticMoveDetail<TItem, TSectionId> = {
  action: "move" | "rollback";
  item: TItem;
  targetSectionId: TSectionId;
  targetIndex: number;
};

export function GuideSectionSidebarList({
  sections,
  activeGuideSlug,
  canManage,
  creatingSectionId,
  onAddPage,
  onRename,
  onDeleteSection,
  onSelectGuidePage,
  onDeleteGuidePage,
  onReorderGuidePages,
  onMoveGuidePage,
}: {
  sections: GuideNavigation;
  activeGuideSlug?: string;
  canManage: boolean;
  creatingSectionId: Id<"guideSections"> | null;
  onAddPage: (sectionId: Id<"guideSections">) => Promise<void>;
  onRename: (section: GuideSectionItem) => void;
  onDeleteSection: (section: GuideSectionItem) => void;
  onSelectGuidePage: (slug: string) => Promise<void>;
  onDeleteGuidePage: (guidePage: GuidePageItem) => void;
  onReorderGuidePages: (guidePages: GuidePageItem[]) => Promise<void>;
  onMoveGuidePage: (
    guidePage: GuidePageItem,
    sourceGuidePages: GuidePageItem[],
    targetSectionId: Id<"guideSections">,
    targetIndex: number,
  ) => Promise<void>;
}) {
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup
          key={section._id}
          data-guide-section-drop-zone
          className="project-documentation-group"
        >
          <SidebarGroupLabel
            className={cn(
              "project-documentation-section-label",
              canManage && "project-documentation-section-label-actions",
            )}
          >
            {section.title}
          </SidebarGroupLabel>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarGroupAction
                  className="project-documentation-section-action"
                  aria-label={`Actions for ${section.title}`}
                >
                  <MoreHorizontal />
                </SidebarGroupAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={creatingSectionId !== null}
                    onSelect={() => void onAddPage(section._id)}
                  >
                    <Plus />
                    {creatingSectionId === section._id
                      ? "Creating Page..."
                      : "Add Page"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onRename(section)}>
                    <Pencil /> Rename Section
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDeleteSection(section)}
                  >
                    <Trash2 /> Delete Section
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <SidebarGroupContent>
            <GuidePageSidebarList
              sectionId={section._id}
              guidePages={section.pages}
              activeGuideSlug={activeGuideSlug}
              canManage={canManage}
              onSelectGuidePage={onSelectGuidePage}
              onDeleteGuidePage={onDeleteGuidePage}
              onReorderGuidePages={onReorderGuidePages}
              onMoveGuidePage={onMoveGuidePage}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

export function GuidePageSidebarList({
  sectionId,
  guidePages,
  activeGuideSlug,
  canManage,
  onSelectGuidePage,
  onDeleteGuidePage,
  onReorderGuidePages,
  onMoveGuidePage,
}: {
  sectionId: Id<"guideSections">;
  guidePages: GuidePageItem[];
  activeGuideSlug?: string;
  canManage: boolean;
  onSelectGuidePage: (slug: string) => Promise<void>;
  onDeleteGuidePage: (guidePage: GuidePageItem) => void;
  onReorderGuidePages: (guidePages: GuidePageItem[]) => Promise<void>;
  onMoveGuidePage: (
    guidePage: GuidePageItem,
    sourceGuidePages: GuidePageItem[],
    targetSectionId: Id<"guideSections">,
    targetIndex: number,
  ) => Promise<void>;
}) {
  const incomingOrderKey = guidePages
    .map((guidePage) => guidePage._id)
    .join("|");
  const [orderedGuidePages, setOrderedGuidePages] = useState(guidePages);
  const [draggedGuidePageId, setDraggedGuidePageId] =
    useState<Id<"guidePages"> | null>(null);
  const [dropPosition, setDropPosition] = useState<EndpointDropPosition | null>(
    null,
  );
  const dragRef = useRef<EndpointDrag | null>(null);
  const dropPositionRef = useRef<EndpointDropPosition | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const pendingOrderRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      pendingOrderRef.current &&
      pendingOrderRef.current !== incomingOrderKey
    ) {
      return;
    }

    pendingOrderRef.current = null;
    setOrderedGuidePages(guidePages);
  }, [incomingOrderKey, guidePages]);

  useEffect(() => {
    function handleOptimisticMove(event: Event) {
      const detail = (
        event as CustomEvent<
          OptimisticMoveDetail<GuidePageItem, Id<"guideSections">>
        >
      ).detail;
      if (detail.targetSectionId !== sectionId) return;

      if (detail.action === "rollback") {
        pendingOrderRef.current = null;
        setOrderedGuidePages(guidePages);
        return;
      }

      setOrderedGuidePages((current) => {
        const nextGuidePages = current.filter(
          (guidePage) => guidePage._id !== detail.item._id,
        );
        nextGuidePages.splice(detail.targetIndex, 0, detail.item);
        pendingOrderRef.current = nextGuidePages
          .map((guidePage) => guidePage._id)
          .join("|");
        return nextGuidePages;
      });
    }

    window.addEventListener(GUIDE_OPTIMISTIC_MOVE_EVENT, handleOptimisticMove);
    return () =>
      window.removeEventListener(
        GUIDE_OPTIMISTIC_MOVE_EVENT,
        handleOptimisticMove,
      );
  }, [guidePages, sectionId]);

  function getRows(listElement: HTMLElement) {
    return Array.from(
      listElement.querySelectorAll<HTMLElement>(
        ":scope > [data-guide-page-row]",
      ),
    );
  }

  function updatePreview(clientY: number) {
    const drag = dragRef.current;
    if (!drag || !previewRef.current) return;

    previewRef.current.style.top = `${clientY - drag.previewOffsetY}px`;
  }

  function removePreview() {
    previewRef.current?.remove();
    previewRef.current = null;
  }

  function startPreview(drag: EndpointDrag) {
    const sourceRow = getRows(drag.listElement)[drag.sourceIndex];
    if (!sourceRow) return;

    const rect = sourceRow.getBoundingClientRect();
    const preview = sourceRow.cloneNode(true) as HTMLElement;
    preview.removeAttribute("data-guide-page-row");
    preview.classList.add("endpoint-drag-preview");
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    document.body.append(preview);
    previewRef.current = preview;
  }

  function getDropPosition(listElement: HTMLElement, clientY: number) {
    const rows = getRows(listElement);
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return { index, edge: "before" } satisfies EndpointDropPosition;
      }
    }

    return rows.length > 0
      ? ({
          index: rows.length - 1,
          edge: "after",
        } satisfies EndpointDropPosition)
      : null;
  }

  function finishDrag() {
    removePreview();
    dragRef.current?.targetListElement?.classList.remove(
      "endpoint-cross-section-target",
    );
    dragRef.current?.targetIndicatorElement?.remove();
    dragRef.current = null;
    dropPositionRef.current = null;
    setDraggedGuidePageId(null);
    setDropPosition(null);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (event.button !== 0) return;

    const listElement = event.currentTarget.closest<HTMLElement>(
      "[data-guide-page-list]",
    );
    const sourceRow = event.currentTarget.closest<HTMLElement>(
      "[data-guide-page-row]",
    );
    if (!listElement || !sourceRow) return;

    const rect = sourceRow.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      sourceIndex,
      startX: event.clientX,
      startY: event.clientY,
      previewOffsetY: event.clientY - rect.top,
      listElement,
      started: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5
    ) {
      return;
    }

    if (!drag.started) {
      drag.started = true;
      setDraggedGuidePageId(orderedGuidePages[drag.sourceIndex]?._id ?? null);
      startPreview(drag);
    }

    updatePreview(event.clientY);
    const pointElement = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    const targetListElement =
      pointElement?.closest<HTMLElement>("[data-guide-page-list]") ??
      pointElement
        ?.closest<HTMLElement>("[data-guide-section-drop-zone]")
        ?.querySelector<HTMLElement>("[data-guide-page-list]");
    if (drag.targetListElement !== targetListElement) {
      drag.targetListElement?.classList.remove("endpoint-cross-section-target");
      if (targetListElement && targetListElement !== drag.listElement) {
        targetListElement.classList.add("endpoint-cross-section-target");
      }
      drag.targetListElement = targetListElement ?? undefined;
    }
    if (targetListElement && targetListElement !== drag.listElement) {
      const targetPosition = getDropPosition(targetListElement, event.clientY);
      const targetRows = getRows(targetListElement);
      const targetIndex = targetPosition
        ? targetPosition.index + (targetPosition.edge === "after" ? 1 : 0)
        : 0;
      drag.targetIndex = targetIndex;
      const indicatorElement = targetPosition
        ? targetRows[targetPosition.index]
        : targetListElement;
      const indicatorRect = indicatorElement?.getBoundingClientRect();
      if (indicatorRect) {
        const indicator =
          drag.targetIndicatorElement ?? document.createElement("div");
        if (!drag.targetIndicatorElement) {
          indicator.className = "endpoint-cross-section-drop-indicator";
          document.body.append(indicator);
          drag.targetIndicatorElement = indicator;
        }
        indicator.style.left = `${indicatorRect.left + 4}px`;
        indicator.style.width = `${Math.max(0, indicatorRect.width - 8)}px`;
        indicator.style.top = `${
          targetPosition
            ? targetPosition.edge === "before"
              ? indicatorRect.top
              : indicatorRect.bottom
            : indicatorRect.top + indicatorRect.height / 2
        }px`;
      }
    } else {
      drag.targetIndex = undefined;
      drag.targetIndicatorElement?.remove();
      drag.targetIndicatorElement = undefined;
    }
    const nextDropPosition = getDropPosition(drag.listElement, event.clientY);
    dropPositionRef.current = nextDropPosition;
    setDropPosition(nextDropPosition);
    event.preventDefault();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const targetListElement = drag.targetListElement;
    if (drag.started && targetListElement !== drag.listElement) {
      const guidePage = orderedGuidePages[drag.sourceIndex];
      const targetSectionId = targetListElement?.dataset.guideSectionId as
        | Id<"guideSections">
        | undefined;
      const targetIndex = drag.targetIndex;
      if (guidePage && targetSectionId && targetIndex !== undefined) {
        const previousGuidePages = orderedGuidePages;
        const sourceGuidePages = orderedGuidePages.filter(
          (_, index) => index !== drag.sourceIndex,
        );
        finishDrag();
        pendingOrderRef.current = sourceGuidePages
          .map((item) => item._id)
          .join("|");
        setOrderedGuidePages(sourceGuidePages);
        window.dispatchEvent(
          new CustomEvent(GUIDE_OPTIMISTIC_MOVE_EVENT, {
            detail: {
              action: "move",
              item: guidePage,
              targetSectionId,
              targetIndex,
            } satisfies OptimisticMoveDetail<
              GuidePageItem,
              Id<"guideSections">
            >,
          }),
        );
        void onMoveGuidePage(
          guidePage,
          sourceGuidePages,
          targetSectionId,
          targetIndex,
        ).catch(() => {
          pendingOrderRef.current = null;
          setOrderedGuidePages(previousGuidePages);
          window.dispatchEvent(
            new CustomEvent(GUIDE_OPTIMISTIC_MOVE_EVENT, {
              detail: {
                action: "rollback",
                item: guidePage,
                targetSectionId,
                targetIndex,
              } satisfies OptimisticMoveDetail<
                GuidePageItem,
                Id<"guideSections">
              >,
            }),
          );
        });
        return;
      }
    }

    const target = dropPositionRef.current;
    if (!drag.started || !target) {
      finishDrag();
      return;
    }

    let targetIndex = target.index + (target.edge === "after" ? 1 : 0);
    if (targetIndex > drag.sourceIndex) {
      targetIndex -= 1;
    }
    targetIndex = Math.max(
      0,
      Math.min(targetIndex, orderedGuidePages.length - 1),
    );

    const previousGuidePages = orderedGuidePages;
    const reorderedGuidePages = reorderEndpointItems(
      orderedGuidePages,
      drag.sourceIndex,
      targetIndex,
    );
    const currentOrderKey = orderedGuidePages
      .map((guidePage) => guidePage._id)
      .join("|");
    const nextOrderKey = reorderedGuidePages
      .map((guidePage) => guidePage._id)
      .join("|");

    finishDrag();
    if (nextOrderKey === currentOrderKey) return;

    pendingOrderRef.current = nextOrderKey;
    setOrderedGuidePages(reorderedGuidePages);
    void onReorderGuidePages(reorderedGuidePages).catch(() => {
      pendingOrderRef.current = null;
      setOrderedGuidePages(previousGuidePages);
    });
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    finishDrag();
  }

  return (
    <SidebarMenu
      data-guide-page-list
      data-guide-section-id={sectionId}
      className="min-h-8"
    >
      {orderedGuidePages.map((guidePage, guidePageIndex) => (
        <SidebarMenuItem
          key={guidePage._id}
          data-guide-page-row
          className={cn(
            "project-documentation-list-item",
            draggedGuidePageId === guidePage._id && "endpoint-is-dragging",
          )}
        >
          {dropPosition?.index === guidePageIndex ? (
            <span
              aria-hidden="true"
              className={`endpoint-drop-indicator endpoint-drop-indicator-${dropPosition.edge}`}
            />
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="endpoint-drag-handle"
              aria-label={`Reorder ${guidePage.title}`}
              title={`Drag to reorder ${guidePage.title}`}
              onPointerDown={(event) =>
                handlePointerDown(event, guidePageIndex)
              }
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              <GripVertical />
            </Button>
          ) : null}
          <EditorGuidePageButton
            isActive={guidePage.slug === activeGuideSlug}
            title={guidePage.title}
            iconName={guidePage.iconName}
            canManage={canManage}
            onSelect={() => onSelectGuidePage(guidePage.slug)}
          />
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="project-documentation-row-action project-documentation-page-action"
                  aria-label={`Actions for ${guidePage.title}`}
                >
                  <MoreHorizontal />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDeleteGuidePage(guidePage)}
                  >
                    <Trash2 /> Delete Page
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function EditorGuidePageButton({
  isActive,
  title,
  iconName,
  canManage,
  onSelect,
}: {
  isActive: boolean;
  title: string;
  iconName?: string;
  canManage: boolean;
  onSelect: () => Promise<void>;
}) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuButton
      isActive={isActive}
      onClick={() => {
        setOpenMobile(false);
        void onSelect();
      }}
      className={cn(
        "project-documentation-row project-documentation-page-button",
        canManage
          ? "project-documentation-row-managed"
          : "project-documentation-row-static",
      )}
    >
      <span className="project-documentation-title-cell">
        <DocumentationIcon iconName={iconName} fallback={FileText} />
        <span className="min-w-0 truncate">{title}</span>
      </span>
    </SidebarMenuButton>
  );
}

export function SectionSidebarList({
  sections,
  activeEndpointSlug,
  canManage,
  creatingSectionId,
  onAddPage,
  onRename,
  onDeleteSection,
  onSelectEndpoint,
  onDeleteEndpoint,
  onReorderEndpoints,
  onMoveEndpoint,
  onReorderSections,
}: {
  sections: Navigation;
  activeEndpointSlug?: string;
  canManage: boolean;
  creatingSectionId: Id<"apiSections"> | null;
  onAddPage: (sectionId: Id<"apiSections">) => Promise<void>;
  onRename: (section: SectionItem) => void;
  onDeleteSection: (section: SectionItem) => void;
  onSelectEndpoint: (slug: string) => Promise<void>;
  onDeleteEndpoint: (endpoint: EndpointItem) => void;
  onReorderEndpoints: (endpoints: EndpointItem[]) => Promise<void>;
  onMoveEndpoint: (
    endpoint: EndpointItem,
    sourceEndpoints: EndpointItem[],
    targetSectionId: Id<"apiSections">,
    targetIndex: number,
  ) => Promise<void>;
  onReorderSections: (sections: SectionItem[]) => Promise<void>;
}) {
  const incomingOrderKey = sections.map((section) => section._id).join("|");
  const [orderedSections, setOrderedSections] = useState(sections);
  const [draggedSectionId, setDraggedSectionId] =
    useState<Id<"apiSections"> | null>(null);
  const [dropPosition, setDropPosition] = useState<SectionDropPosition | null>(
    null,
  );
  const dragRef = useRef<SectionDrag | null>(null);
  const dropPositionRef = useRef<SectionDropPosition | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const pendingOrderRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      pendingOrderRef.current &&
      pendingOrderRef.current !== incomingOrderKey
    ) {
      return;
    }

    pendingOrderRef.current = null;
    setOrderedSections(sections);
  }, [incomingOrderKey, sections]);

  function getRows(listElement: HTMLElement) {
    return Array.from(
      listElement.querySelectorAll<HTMLElement>(":scope > [data-section-row]"),
    );
  }

  function removePreview() {
    previewRef.current?.remove();
    previewRef.current = null;
  }

  function startPreview(drag: SectionDrag) {
    const sourceRow = getRows(drag.listElement)[drag.sourceIndex];
    const sourceLabel = sourceRow?.querySelector<HTMLElement>(
      '[data-sidebar="group-label"]',
    );
    if (!sourceLabel) return;

    const rect = sourceLabel.getBoundingClientRect();
    const preview = sourceLabel.cloneNode(true) as HTMLElement;
    preview.classList.add("section-drag-preview");
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    document.body.append(preview);
    previewRef.current = preview;
  }

  function updatePreview(clientY: number) {
    const drag = dragRef.current;
    if (!drag || !previewRef.current) return;
    previewRef.current.style.top = `${clientY - drag.previewOffsetY}px`;
  }

  function getDropPosition(listElement: HTMLElement, clientY: number) {
    const rows = getRows(listElement);
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return { index, edge: "before" } satisfies SectionDropPosition;
      }
    }

    return rows.length > 0
      ? ({
          index: rows.length - 1,
          edge: "after",
        } satisfies SectionDropPosition)
      : null;
  }

  function finishDrag() {
    removePreview();
    dragRef.current = null;
    dropPositionRef.current = null;
    setDraggedSectionId(null);
    setDropPosition(null);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (event.button !== 0) return;

    const listElement = event.currentTarget.closest<HTMLElement>(
      "[data-section-list]",
    );
    const sourceRow =
      event.currentTarget.closest<HTMLElement>("[data-section-row]");
    const sourceLabel = sourceRow?.querySelector<HTMLElement>(
      '[data-sidebar="group-label"]',
    );
    if (!listElement || !sourceRow || !sourceLabel) return;

    const rect = sourceLabel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      sourceIndex,
      startX: event.clientX,
      startY: event.clientY,
      previewOffsetY: event.clientY - rect.top,
      listElement,
      started: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5
    ) {
      return;
    }

    if (!drag.started) {
      drag.started = true;
      setDraggedSectionId(orderedSections[drag.sourceIndex]?._id ?? null);
      startPreview(drag);
    }

    updatePreview(event.clientY);
    const nextDropPosition = getDropPosition(drag.listElement, event.clientY);
    dropPositionRef.current = nextDropPosition;
    setDropPosition(nextDropPosition);
    event.preventDefault();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const target = dropPositionRef.current;
    if (!drag.started || !target) {
      finishDrag();
      return;
    }

    let targetIndex = target.index + (target.edge === "after" ? 1 : 0);
    if (targetIndex > drag.sourceIndex) {
      targetIndex -= 1;
    }
    targetIndex = Math.max(
      0,
      Math.min(targetIndex, orderedSections.length - 1),
    );

    const previousSections = orderedSections;
    const reorderedSections = reorderSectionItems(
      orderedSections,
      drag.sourceIndex,
      targetIndex,
    );
    const currentOrderKey = orderedSections
      .map((section) => section._id)
      .join("|");
    const nextOrderKey = reorderedSections
      .map((section) => section._id)
      .join("|");

    finishDrag();
    if (nextOrderKey === currentOrderKey) return;

    pendingOrderRef.current = nextOrderKey;
    setOrderedSections(reorderedSections);
    void onReorderSections(reorderedSections).catch(() => {
      pendingOrderRef.current = null;
      setOrderedSections(previousSections);
    });
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    finishDrag();
  }

  return (
    <>
      {orderedSections.map((section, sectionIndex) => (
        <SidebarGroup
          key={section._id}
          data-section-row
          className={cn(
            "project-documentation-group",
            draggedSectionId === section._id && "section-is-dragging",
          )}
        >
          {dropPosition?.index === sectionIndex ? (
            <span
              aria-hidden="true"
              className={`section-drop-indicator section-drop-indicator-${dropPosition.edge}`}
            />
          ) : null}
          <SidebarGroupLabel
            className={cn(
              "project-documentation-section-label",
              canManage && "project-documentation-section-label-managed",
            )}
          >
            {section.title}
          </SidebarGroupLabel>
          {canManage ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="section-drag-handle project-documentation-section-drag"
                aria-label={`Reorder ${section.title} section`}
                title={`Drag to reorder ${section.title}`}
                onPointerDown={(event) =>
                  handlePointerDown(event, sectionIndex)
                }
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              >
                <GripVertical />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarGroupAction
                    className="project-documentation-section-action"
                    aria-label={`Actions for ${section.title}`}
                  >
                    <MoreHorizontal />
                  </SidebarGroupAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={creatingSectionId !== null}
                      onSelect={() => {
                        void onAddPage(section._id);
                      }}
                    >
                      <Plus />
                      {creatingSectionId === section._id
                        ? "Creating Page..."
                        : "Add Page"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onRename(section)}>
                      <Pencil /> Rename Section
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => onDeleteSection(section)}
                    >
                      <Trash2 /> Delete Section
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
          <SidebarGroupContent>
            <EndpointSidebarList
              section={section}
              activeEndpointSlug={activeEndpointSlug}
              canManage={canManage}
              onSelect={onSelectEndpoint}
              onDelete={onDeleteEndpoint}
              onReorder={onReorderEndpoints}
              onMove={onMoveEndpoint}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

export function EndpointSidebarList({
  section,
  activeEndpointSlug,
  canManage,
  onSelect,
  onDelete,
  onReorder,
  onMove,
}: {
  section: Navigation[number];
  activeEndpointSlug?: string;
  canManage: boolean;
  onSelect: (slug: string) => Promise<void>;
  onDelete: (endpoint: EndpointItem) => void;
  onReorder: (endpoints: EndpointItem[]) => Promise<void>;
  onMove: (
    endpoint: EndpointItem,
    sourceEndpoints: EndpointItem[],
    targetSectionId: Id<"apiSections">,
    targetIndex: number,
  ) => Promise<void>;
}) {
  const incomingOrderKey = section.endpoints
    .map((endpoint) => endpoint._id)
    .join("|");
  const [orderedEndpoints, setOrderedEndpoints] = useState(section.endpoints);
  const [draggedEndpointId, setDraggedEndpointId] =
    useState<Id<"apiEndpoints"> | null>(null);
  const [dropPosition, setDropPosition] = useState<EndpointDropPosition | null>(
    null,
  );
  const dragRef = useRef<EndpointDrag | null>(null);
  const dropPositionRef = useRef<EndpointDropPosition | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const pendingOrderRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      pendingOrderRef.current &&
      pendingOrderRef.current !== incomingOrderKey
    ) {
      return;
    }

    pendingOrderRef.current = null;
    setOrderedEndpoints(section.endpoints);
  }, [incomingOrderKey, section.endpoints]);

  useEffect(() => {
    function handleOptimisticMove(event: Event) {
      const detail = (
        event as CustomEvent<
          OptimisticMoveDetail<EndpointItem, Id<"apiSections">>
        >
      ).detail;
      if (detail.targetSectionId !== section._id) return;

      if (detail.action === "rollback") {
        pendingOrderRef.current = null;
        setOrderedEndpoints(section.endpoints);
        return;
      }

      setOrderedEndpoints((current) => {
        const nextEndpoints = current.filter(
          (endpoint) => endpoint._id !== detail.item._id,
        );
        nextEndpoints.splice(detail.targetIndex, 0, detail.item);
        pendingOrderRef.current = nextEndpoints
          .map((endpoint) => endpoint._id)
          .join("|");
        return nextEndpoints;
      });
    }

    window.addEventListener(
      ENDPOINT_OPTIMISTIC_MOVE_EVENT,
      handleOptimisticMove,
    );
    return () =>
      window.removeEventListener(
        ENDPOINT_OPTIMISTIC_MOVE_EVENT,
        handleOptimisticMove,
      );
  }, [section._id, section.endpoints]);

  function getRows(listElement: HTMLElement) {
    return Array.from(
      listElement.querySelectorAll<HTMLElement>(":scope > [data-endpoint-row]"),
    );
  }

  function updatePreview(clientY: number) {
    const drag = dragRef.current;
    if (!drag || !previewRef.current) return;

    previewRef.current.style.top = `${clientY - drag.previewOffsetY}px`;
  }

  function removePreview() {
    previewRef.current?.remove();
    previewRef.current = null;
  }

  function startPreview(drag: EndpointDrag) {
    const sourceRow = getRows(drag.listElement)[drag.sourceIndex];
    if (!sourceRow) return;

    const rect = sourceRow.getBoundingClientRect();
    const preview = sourceRow.cloneNode(true) as HTMLElement;
    preview.removeAttribute("data-endpoint-row");
    preview.classList.add("endpoint-drag-preview");
    preview.style.left = `${rect.left}px`;
    preview.style.top = `${rect.top}px`;
    preview.style.width = `${rect.width}px`;
    document.body.append(preview);
    previewRef.current = preview;
  }

  function getDropPosition(listElement: HTMLElement, clientY: number) {
    const rows = getRows(listElement);
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return { index, edge: "before" } satisfies EndpointDropPosition;
      }
    }

    return rows.length > 0
      ? ({
          index: rows.length - 1,
          edge: "after",
        } satisfies EndpointDropPosition)
      : null;
  }

  function finishDrag() {
    removePreview();
    dragRef.current?.targetListElement?.classList.remove(
      "endpoint-cross-section-target",
    );
    dragRef.current?.targetIndicatorElement?.remove();
    dragRef.current = null;
    dropPositionRef.current = null;
    setDraggedEndpointId(null);
    setDropPosition(null);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) {
    if (event.button !== 0) return;

    const listElement = event.currentTarget.closest<HTMLElement>(
      "[data-endpoint-list]",
    );
    const sourceRow = event.currentTarget.closest<HTMLElement>(
      "[data-endpoint-row]",
    );
    if (!listElement || !sourceRow) return;

    const rect = sourceRow.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      sourceIndex,
      startX: event.clientX,
      startY: event.clientY,
      previewOffsetY: event.clientY - rect.top,
      listElement,
      started: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (
      !drag.started &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5
    ) {
      return;
    }

    if (!drag.started) {
      drag.started = true;
      setDraggedEndpointId(orderedEndpoints[drag.sourceIndex]?._id ?? null);
      startPreview(drag);
    }

    updatePreview(event.clientY);
    const pointElement = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    const targetListElement =
      pointElement?.closest<HTMLElement>("[data-endpoint-list]") ??
      pointElement
        ?.closest<HTMLElement>("[data-section-row]")
        ?.querySelector<HTMLElement>("[data-endpoint-list]");
    if (drag.targetListElement !== targetListElement) {
      drag.targetListElement?.classList.remove("endpoint-cross-section-target");
      if (targetListElement && targetListElement !== drag.listElement) {
        targetListElement.classList.add("endpoint-cross-section-target");
      }
      drag.targetListElement = targetListElement ?? undefined;
    }
    if (targetListElement && targetListElement !== drag.listElement) {
      const targetPosition = getDropPosition(targetListElement, event.clientY);
      const targetRows = getRows(targetListElement);
      const targetIndex = targetPosition
        ? targetPosition.index + (targetPosition.edge === "after" ? 1 : 0)
        : 0;
      drag.targetIndex = targetIndex;
      const indicatorElement = targetPosition
        ? targetRows[targetPosition.index]
        : targetListElement;
      const indicatorRect = indicatorElement?.getBoundingClientRect();
      if (indicatorRect) {
        const indicator =
          drag.targetIndicatorElement ?? document.createElement("div");
        if (!drag.targetIndicatorElement) {
          indicator.className = "endpoint-cross-section-drop-indicator";
          document.body.append(indicator);
          drag.targetIndicatorElement = indicator;
        }
        indicator.style.left = `${indicatorRect.left + 4}px`;
        indicator.style.width = `${Math.max(0, indicatorRect.width - 8)}px`;
        indicator.style.top = `${
          targetPosition
            ? targetPosition.edge === "before"
              ? indicatorRect.top
              : indicatorRect.bottom
            : indicatorRect.top + indicatorRect.height / 2
        }px`;
      }
    } else {
      drag.targetIndex = undefined;
      drag.targetIndicatorElement?.remove();
      drag.targetIndicatorElement = undefined;
    }
    const nextDropPosition = getDropPosition(drag.listElement, event.clientY);
    dropPositionRef.current = nextDropPosition;
    setDropPosition(nextDropPosition);
    event.preventDefault();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const targetListElement = drag.targetListElement;
    if (drag.started && targetListElement !== drag.listElement) {
      const endpointItem = orderedEndpoints[drag.sourceIndex];
      const targetSectionId = targetListElement?.dataset.endpointSectionId as
        | Id<"apiSections">
        | undefined;
      const targetIndex = drag.targetIndex;
      if (endpointItem && targetSectionId && targetIndex !== undefined) {
        const previousEndpoints = orderedEndpoints;
        const sourceEndpoints = orderedEndpoints.filter(
          (_, index) => index !== drag.sourceIndex,
        );
        finishDrag();
        pendingOrderRef.current = sourceEndpoints
          .map((item) => item._id)
          .join("|");
        setOrderedEndpoints(sourceEndpoints);
        window.dispatchEvent(
          new CustomEvent(ENDPOINT_OPTIMISTIC_MOVE_EVENT, {
            detail: {
              action: "move",
              item: endpointItem,
              targetSectionId,
              targetIndex,
            } satisfies OptimisticMoveDetail<EndpointItem, Id<"apiSections">>,
          }),
        );
        void onMove(
          endpointItem,
          sourceEndpoints,
          targetSectionId,
          targetIndex,
        ).catch(() => {
          pendingOrderRef.current = null;
          setOrderedEndpoints(previousEndpoints);
          window.dispatchEvent(
            new CustomEvent(ENDPOINT_OPTIMISTIC_MOVE_EVENT, {
              detail: {
                action: "rollback",
                item: endpointItem,
                targetSectionId,
                targetIndex,
              } satisfies OptimisticMoveDetail<EndpointItem, Id<"apiSections">>,
            }),
          );
        });
        return;
      }
    }

    const target = dropPositionRef.current;
    if (!drag.started || !target) {
      finishDrag();
      return;
    }

    let targetIndex = target.index + (target.edge === "after" ? 1 : 0);
    if (targetIndex > drag.sourceIndex) {
      targetIndex -= 1;
    }
    targetIndex = Math.max(
      0,
      Math.min(targetIndex, orderedEndpoints.length - 1),
    );

    const previousEndpoints = orderedEndpoints;
    const reorderedEndpoints = reorderEndpointItems(
      orderedEndpoints,
      drag.sourceIndex,
      targetIndex,
    );
    const currentOrderKey = orderedEndpoints
      .map((endpoint) => endpoint._id)
      .join("|");
    const nextOrderKey = reorderedEndpoints
      .map((endpoint) => endpoint._id)
      .join("|");

    finishDrag();
    if (nextOrderKey === currentOrderKey) return;

    pendingOrderRef.current = nextOrderKey;
    setOrderedEndpoints(reorderedEndpoints);
    void onReorder(reorderedEndpoints).catch(() => {
      pendingOrderRef.current = null;
      setOrderedEndpoints(previousEndpoints);
    });
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    finishDrag();
  }

  return (
    <SidebarMenu
      data-endpoint-list
      data-endpoint-section-id={section._id}
      className="min-h-8"
    >
      {orderedEndpoints.map((item, endpointIndex) => (
        <SidebarMenuItem
          key={item._id}
          data-endpoint-row
          className={cn(
            "project-documentation-list-item",
            draggedEndpointId === item._id && "endpoint-is-dragging",
          )}
        >
          {dropPosition?.index === endpointIndex ? (
            <span
              aria-hidden="true"
              className={`endpoint-drop-indicator endpoint-drop-indicator-${dropPosition.edge}`}
            />
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="endpoint-drag-handle"
              aria-label={`Reorder ${item.title}`}
              title={`Drag to reorder ${item.title}`}
              onPointerDown={(event) => handlePointerDown(event, endpointIndex)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              <GripVertical />
            </Button>
          ) : null}
          <EditorEndpointButton
            isActive={item.slug === activeEndpointSlug}
            isDocument={item.endpointType === "doc"}
            title={item.title}
            iconName={item.endpointType === "doc" ? item.iconName : undefined}
            method={item.endpointType === "endpoint" ? item.method : undefined}
            canManage={canManage}
            onSelect={() => onSelect(item.slug)}
          />
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className={cn(
                    "project-documentation-row-action",
                    item.endpointType === "endpoint"
                      ? "project-documentation-endpoint-action"
                      : "project-documentation-page-action",
                  )}
                  aria-label={`Actions for ${item.title}`}
                >
                  <MoreHorizontal />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(item)}
                  >
                    <Trash2 /> Delete Endpoint
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function EditorEndpointButton({
  isActive,
  isDocument,
  title,
  iconName,
  method,
  canManage,
  onSelect,
}: {
  isActive: boolean;
  isDocument: boolean;
  title: string;
  iconName?: string;
  method?: string;
  canManage: boolean;
  onSelect: () => Promise<void>;
}) {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenuButton
      isActive={isActive}
      onClick={() => {
        setOpenMobile(false);
        void onSelect();
      }}
      className={cn(
        "project-documentation-row",
        isDocument
          ? "project-documentation-document-button"
          : "project-documentation-endpoint-button",
        canManage
          ? "project-documentation-row-managed"
          : "project-documentation-row-static",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {isDocument ? (
          <DocumentationIcon iconName={iconName} fallback={FileCode2} />
        ) : null}
        <span className="min-w-0 truncate">{title}</span>
      </span>
      {method ? (
        <span
          className={cn(
            "inline-flex h-5 min-w-11 items-center justify-center justify-self-end rounded-sm px-1.5 font-mono text-[9px] text-white",
            method === "GET" && "bg-emerald-600",
            method === "POST" && "bg-blue-600",
            (method === "PUT" || method === "PATCH") && "bg-violet-600",
            method === "DELETE" && "bg-red-600",
            (method === "OPTIONS" || method === "HEAD") && "bg-slate-600",
          )}
        >
          {method}
        </span>
      ) : (
        <span className="sr-only">Document</span>
      )}
    </SidebarMenuButton>
  );
}
