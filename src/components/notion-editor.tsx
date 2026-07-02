import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { useMutation } from "convex/react";
import {
  EditorContent,
  useEditor,
  type Content,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import { Suggestion } from "@tiptap/suggestion";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { JSONContent } from "@tiptap/core";
import {
  Baseline,
  Bold,
  Code,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  GripVertical,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Columns3,
  Merge,
  Minus,
  PanelTop,
  Quote,
  Rows3,
  SplitSquareVertical,
  Strikethrough,
  Table2,
  Trash2,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getErrorMessage } from "../lib/errors";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useToast } from "./ui/toast";
import {
  CodeTabsExtension,
  createInitialCodeTabs,
} from "./code-tabs";

type EditorChangeHandler = (json: JSONContent) => void;

interface NotionEditorProps {
  projectId: Id<"apiProjects">;
  content: JSONContent | null;
  onChange: EditorChangeHandler;
  readOnly?: boolean;
}

interface SlashCommandItem {
  title: string;
  description: string;
  group: "Basic blocks" | "Media";
  icon: LucideIcon;
  command: (ctx: { editor: any; range: any }) => void;
}

type BlockHandlePosition = {
  index: number;
  top: number;
};

type BlockDropPosition = {
  index: number;
  edge: "before" | "after";
  top: number;
};

type PointerDragState = {
  pointerId: number;
  index: number;
  startX: number;
  startY: number;
  previewOffsetY: number;
  started: boolean;
};

function isTextRangeSelection(selection: unknown): selection is TextSelection {
  return selection instanceof TextSelection && !selection.empty;
}

function isTableCellSelection(selection: unknown): selection is CellSelection {
  return selection instanceof CellSelection;
}

function shouldShowFormattingBubble({
  editor,
  selection,
}: {
  editor: Editor;
  selection: unknown;
}) {
  return (
    isTextRangeSelection(selection) &&
    !editor.isActive("codeTabs")
  );
}

function shouldShowTableBubble({
  editor,
  selection,
}: {
  editor: Editor;
  selection: { empty?: boolean } | unknown;
}) {
  if (!editor.isActive("table")) return false;
  if (isTableCellSelection(selection)) return true;

  return Boolean(
    selection &&
      typeof selection === "object" &&
      "empty" in selection &&
      selection.empty,
  );
}

function BubbleTooltipButton({
  tooltip,
  isActive,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  isActive?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="bubble-tooltip-trigger">
          <button
            type="button"
            className={cn(isActive && "is-active", className)}
            aria-label={props["aria-label"] ?? tooltip}
            {...props}
          >
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function reorderBlocks<T>(
  blocks: readonly T[],
  fromIndex: number,
  toIndex: number,
) {
  if (
    fromIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex < 0 ||
    toIndex >= blocks.length ||
    fromIndex === toIndex
  ) {
    return [...blocks];
  }

  const reordered = [...blocks];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

function topLevelBlockPosition(doc: ProseMirrorNode, index: number) {
  let position = 0;
  for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
    position += doc.child(currentIndex).nodeSize;
  }
  return position;
}

function reorderEditorBlocks(
  editor: Editor,
  fromIndex: number,
  toIndex: number,
) {
  const blocks: ProseMirrorNode[] = [];
  editor.state.doc.forEach((node) => blocks.push(node));
  const reordered = reorderBlocks(blocks, fromIndex, toIndex);

  if (reordered.every((node, index) => node === blocks[index])) return;

  editor.view.dispatch(
    editor.state.tr
      .replaceWith(
        0,
        editor.state.doc.content.size,
        Fragment.fromArray(reordered),
      )
      .scrollIntoView(),
  );
}

function deleteEditorBlock(editor: Editor, index: number) {
  const { doc, schema } = editor.state;
  if (index < 0 || index >= doc.childCount) return;

  if (doc.childCount === 1) {
    editor.view.dispatch(
      editor.state.tr
        .replaceWith(0, doc.content.size, schema.nodes.paragraph.create())
        .scrollIntoView(),
    );
    return;
  }

  const from = topLevelBlockPosition(doc, index);
  editor.view.dispatch(
    editor.state.tr.delete(from, from + doc.child(index).nodeSize).scrollIntoView(),
  );
}

function createSlashCommands(
  openImagePicker: (ctx: { editor: any; range: any }) => void,
): SlashCommandItem[] {
  return [
    {
      title: "Text",
      description: "Plain text",
      group: "Basic blocks",
      icon: Baseline,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "Heading 1",
      description: "Large heading",
      group: "Basic blocks",
      icon: Heading1,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium heading",
      group: "Basic blocks",
      icon: Heading2,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "Heading 3",
      description: "Small heading",
      group: "Basic blocks",
      icon: Heading3,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      title: "Bullet List",
      description: "Bulleted items",
      group: "Basic blocks",
      icon: List,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered List",
      description: "Numbered items",
      group: "Basic blocks",
      icon: ListOrdered,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Blockquote",
      description: "Quoted text",
      group: "Basic blocks",
      icon: Quote,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "Code Block",
      description: "Tabbed code with syntax highlighting",
      group: "Basic blocks",
      icon: FileCode2,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "codeTabs",
            attrs: { tabs: createInitialCodeTabs() },
          })
          .run();
      },
    },
    {
      title: "Table",
      description: "Table with rows and columns",
      group: "Basic blocks",
      icon: Table2,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: "Image",
      description: "Upload an image",
      group: "Media",
      icon: ImageIcon,
      command: openImagePicker,
    },
    {
      title: "Callout",
      description: "Highlighted info box",
      group: "Media",
      icon: Info,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "paragraph",
            attrs: { class: "callout" },
            content: [{ type: "text", text: "\uD83D\uDCA1 " }],
          })
          .run();
      },
    },
    {
      title: "Divider",
      description: "Horizontal line",
      group: "Media",
      icon: Minus,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
  ];
}

function SlashCommandMenu({
  items,
  command,
  selectedIndex,
  onSelectIndex,
}: {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}) {
  let currentGroup: SlashCommandItem["group"] | null = null;

  return (
    <div className="slash-menu">
      <div className="slash-menu-header">
        <span>Insert</span>
        <kbd>ESC</kbd>
      </div>
      {items.map((item, index) => {
        const Icon = item.icon;
        const showGroup = item.group !== currentGroup;
        currentGroup = item.group;

        return (
          <div key={item.title}>
            {showGroup ? (
              <div className="slash-menu-group">{item.group}</div>
            ) : null}
            <button
              type="button"
              className={cn(
                "slash-menu-item w-full",
                index === selectedIndex && "is-selected",
              )}
              onClick={() => command(item)}
              onMouseEnter={() => onSelectIndex(index)}
            >
              <span className="slash-icon">
                <Icon />
              </span>
              <span className="slash-copy">
                <span className="slash-label">{item.title}</span>
                <span className="slash-desc">{item.description}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function createSlashCommandRender(slashCommands: SlashCommandItem[]) {
  let root: Root | null = null;
  let popupElement: HTMLElement | null = null;
  let selectedIndex = 0;
  let currentItems: SlashCommandItem[] = [];
  let currentCommand: ((item: SlashCommandItem) => void) | null = null;

  function destroyPopup() {
    if (root) {
      root.unmount();
      root = null;
    }
    if (popupElement) {
      popupElement.remove();
      popupElement = null;
    }
  }

  function renderMenu(
    items: SlashCommandItem[],
    command: (item: SlashCommandItem) => void,
    clientRectFn?: (() => DOMRect | null) | null,
  ) {
    currentItems = items;
    currentCommand = command;
    selectedIndex = 0;

    if (!popupElement) {
      popupElement = document.createElement("div");
      document.body.appendChild(popupElement);
    }

    const rect = clientRectFn?.();
    if (rect) {
      popupElement.style.position = "fixed";
      popupElement.style.left = `${rect.left}px`;
      popupElement.style.top = `${rect.bottom + 4}px`;
      popupElement.style.zIndex = "9999";
    }

    if (!root) {
      root = createRoot(popupElement);
    }

    root.render(
      <SlashCommandMenu
        items={items}
        selectedIndex={selectedIndex}
        onSelectIndex={(index) => {
          selectedIndex = index;
        }}
        command={command}
      />,
    );
  }

  function updatePosition(clientRectFn?: (() => DOMRect | null) | null) {
    if (!popupElement) return;
    const rect = clientRectFn?.();
    if (rect) {
      popupElement.style.left = `${rect.left}px`;
      popupElement.style.top = `${rect.bottom + 4}px`;
    }
  }

  return {
    onStart: (props: SuggestionProps<SlashCommandItem>) => {
      const filtered = slashCommands.filter(
        (item) =>
          item.title.toLowerCase().includes(props.query.toLowerCase()) ||
          item.description.toLowerCase().includes(props.query.toLowerCase()),
      );
      if (filtered.length === 0) return;
      renderMenu(filtered, props.command, props.clientRect);
    },
    onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
      const filtered = slashCommands.filter(
        (item) =>
          item.title.toLowerCase().includes(props.query.toLowerCase()) ||
          item.description.toLowerCase().includes(props.query.toLowerCase()),
      );
      if (filtered.length === 0) {
        destroyPopup();
        return;
      }
      updatePosition(props.clientRect);
      currentItems = filtered;
      currentCommand = props.command;
      if (root && popupElement) {
        root.render(
          <SlashCommandMenu
            items={filtered}
            selectedIndex={selectedIndex}
            onSelectIndex={(index) => {
              selectedIndex = index;
            }}
            command={props.command}
          />,
        );
      }
    },
    onKeyDown: (keyProps: SuggestionKeyDownProps) => {
      if (keyProps.event.key === "ArrowDown") {
        if (currentItems.length === 0) return false;
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        if (root && popupElement) {
          root.render(
            <SlashCommandMenu
              items={currentItems}
              selectedIndex={selectedIndex}
              onSelectIndex={(index) => {
                selectedIndex = index;
              }}
              command={(item) => currentCommand?.(item)}
            />,
          );
        }
        return true;
      }
      if (keyProps.event.key === "ArrowUp") {
        if (currentItems.length === 0) return false;
        selectedIndex =
          (selectedIndex - 1 + currentItems.length) % currentItems.length;
        if (root && popupElement) {
          root.render(
            <SlashCommandMenu
              items={currentItems}
              selectedIndex={selectedIndex}
              onSelectIndex={(index) => {
                selectedIndex = index;
              }}
              command={(item) => currentCommand?.(item)}
            />,
          );
        }
        return true;
      }
      if (keyProps.event.key === "Enter") {
        const item = currentItems[selectedIndex];
        if (item && currentCommand) {
          currentCommand(item);
          return true;
        }
      }
      if (keyProps.event.key === "Escape") {
        destroyPopup();
        return true;
      }
      return false;
    },
    onExit: () => {
      destroyPopup();
    },
  };
}

function createSlashCommand(slashCommands: SlashCommandItem[]) {
  return Extension.create({
    name: "slashCommand",

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommandItem>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          decorationClass: "slash-command-decoration",
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          items: ({ query }) => {
            return slashCommands.filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.description.toLowerCase().includes(query.toLowerCase()),
            );
          },
          render: () => createSlashCommandRender(slashCommands),
        }),
      ];
    },
  });
}

export function NotionEditor({
  projectId,
  content,
  onChange,
  readOnly = false,
}: NotionEditorProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageEditorRef = useRef<any>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const draggedBlockIndexRef = useRef<number | null>(null);
  const draggedBlockElementRef = useRef<HTMLElement | null>(null);
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const dropPositionRef = useRef<BlockDropPosition | null>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const suppressBlockMenuClickRef = useRef(false);
  const [blockHandle, setBlockHandle] = useState<BlockHandlePosition | null>(
    null,
  );
  const [dropPosition, setDropPosition] =
    useState<BlockDropPosition | null>(null);
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const generateImageUploadUrl = useMutation(api.files.generateImageUploadUrl);
  const completeImageUpload = useMutation(api.files.completeImageUpload);
  const toast = useToast();

  useEffect(() => {
    setIsMounted(true);
    return () => {
      dragPreviewRef.current?.remove();
      draggedBlockElementRef.current?.classList.remove("is-block-dragging");
    };
  }, []);

  const openImagePicker = useCallback(
    ({ editor, range }: { editor: any; range: any }) => {
      editor.chain().focus().deleteRange(range).run();
      imageEditorRef.current = editor;
      imageInputRef.current?.click();
    },
    [],
  );
  const slashCommands = useMemo(
    () => createSlashCommands(openImagePicker),
    [openImagePicker],
  );
  const slashCommand = useMemo(
    () => createSlashCommand(slashCommands),
    [slashCommands],
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          link: false,
        }),
        Placeholder.configure({
          placeholder: "Type / for commands",
        }),
        LinkExtension.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "underline text-primary",
          },
        }),
        ImageExtension.configure({
          allowBase64: false,
          HTMLAttributes: {
            class: "notion-image",
            loading: "lazy",
          },
        }),
        TableKit.configure({
          table: {
            resizable: true,
            renderWrapper: true,
            HTMLAttributes: {
              class: "notion-table",
            },
          },
        }),
        CodeTabsExtension,
        slashCommand,
      ],
      content: content as Content,
      editable: !readOnly,
      editorProps: {
        attributes: {
          class: "ProseMirror",
        },
      },
      onUpdate: ({ editor }) => {
        onChange(editor.getJSON());
      },
      immediatelyRender: false,
    },
    [slashCommand],
  );

  useEffect(() => {
    if (!editor || !isMounted) return;
    const currentJson = editor.getJSON();
    const contentStr = JSON.stringify(content ?? null);
    const currentStr = JSON.stringify(currentJson);

    if (contentStr !== currentStr) {
      editor.commands.setContent(content as Content, { emitUpdate: false });
    }
  }, [content, editor, isMounted]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Link URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  }, [editor]);

  const uploadImage = useCallback(
    async (file: File) => {
      const allowedTypes = new Set([
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
      if (!allowedTypes.has(file.type)) {
        toast.error("Images must be PNG, JPEG, GIF, or WebP");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Images must be 10 MB or smaller");
        return;
      }

      setIsUploadingImage(true);
      try {
        const uploadUrl = await generateImageUploadUrl({ projectId });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) {
          throw new Error("Image upload failed");
        }

        const payload = (await response.json()) as { storageId: string };
        const uploaded = await completeImageUpload({
          projectId,
          storageId: payload.storageId as Id<"_storage">,
          fileName: file.name,
        });
        const targetEditor = imageEditorRef.current ?? editor;
        targetEditor
          ?.chain()
          .focus()
          .setImage({
            src: uploaded.url,
            alt: file.name,
            title: file.name,
          })
          .run();
        toast.success("Image uploaded");
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to upload image"));
      } finally {
        setIsUploadingImage(false);
        imageEditorRef.current = null;
        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }
      }
    },
    [
      completeImageUpload,
      editor,
      generateImageUploadUrl,
      projectId,
      toast,
    ],
  );

  const findBlockAtTarget = useCallback(
    (target: EventTarget | null): BlockHandlePosition | null => {
      if (!editor || !editorContainerRef.current) return null;

      const editorElement = editor.view.dom;
      let element =
        target instanceof HTMLElement
          ? target
          : target instanceof globalThis.Node
            ? target.parentElement
            : null;

      while (element && element.parentElement !== editorElement) {
        element = element.parentElement;
      }

      if (!element || element.parentElement !== editorElement) return null;

      const index = Array.from(editorElement.children).indexOf(element);
      if (index < 0 || index >= editor.state.doc.childCount) return null;

      const containerRect =
        editorContainerRef.current.getBoundingClientRect();
      const blockRect = element.getBoundingClientRect();
      return {
        index,
        top: blockRect.top - containerRect.top,
      };
    },
    [editor],
  );

  const findDropPositionAtY = useCallback(
    (clientY: number): BlockDropPosition | null => {
      if (!editor || !editorContainerRef.current) return null;

      const elements = Array.from(editor.view.dom.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );
      if (elements.length === 0) return null;

      const containerRect =
        editorContainerRef.current.getBoundingClientRect();

      for (let index = 0; index < elements.length; index += 1) {
        const rect = elements[index].getBoundingClientRect();
        if (clientY <= rect.top + rect.height / 2) {
          return {
            index,
            edge: "before",
            top: rect.top - containerRect.top,
          };
        }
      }

      const lastIndex = elements.length - 1;
      const lastRect = elements[lastIndex].getBoundingClientRect();
      return {
        index: lastIndex,
        edge: "after",
        top: lastRect.bottom - containerRect.top,
      };
    },
    [editor],
  );

  function handleEditorMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (readOnly || isBlockMenuOpen || isDraggingBlock) return;
    const nextBlock = findBlockAtTarget(event.target);
    if (nextBlock) setBlockHandle(nextBlock);
  }

  function startBlockDrag(clientY: number) {
    if (!blockHandle || !editor) return;

    const blockElement = editor.view.dom.children[blockHandle.index];
    if (!(blockElement instanceof HTMLElement)) return;

    draggedBlockIndexRef.current = blockHandle.index;
    draggedBlockElementRef.current = blockElement;
    suppressBlockMenuClickRef.current = true;
    blockElement.classList.add("is-block-dragging");

    const blockRect = blockElement.getBoundingClientRect();
    const preview = blockElement.cloneNode(true) as HTMLElement;
    preview.removeAttribute("contenteditable");
    preview.classList.add("notion-block-drag-preview");
    preview.style.width = `${blockRect.width}px`;
    preview.style.left = `${blockRect.left}px`;
    preview.style.top = `${clientY - (pointerDragRef.current?.previewOffsetY ?? 0)}px`;
    document.body.appendChild(preview);
    dragPreviewRef.current = preview;

    setIsBlockMenuOpen(false);
    setIsDraggingBlock(true);
  }

  function updateBlockDrag(clientY: number) {
    const fromIndex = draggedBlockIndexRef.current;
    if (fromIndex === null) return;

    const nextDropPosition = findDropPositionAtY(clientY);
    if (!nextDropPosition) return;

    if (dragPreviewRef.current) {
      dragPreviewRef.current.style.top = `${
        clientY - (pointerDragRef.current?.previewOffsetY ?? 0)
      }px`;
    }

    const currentDropPosition = dropPositionRef.current;
    if (
      currentDropPosition?.index === nextDropPosition.index &&
      currentDropPosition.edge === nextDropPosition.edge
    ) {
      return;
    }

    dropPositionRef.current = nextDropPosition;
    setDropPosition(nextDropPosition);
  }

  function dropBlock() {
    const fromIndex = draggedBlockIndexRef.current;
    const currentDropPosition = dropPositionRef.current;
    if (fromIndex === null || !currentDropPosition || !editor) return;

    const boundaryIndex =
      currentDropPosition.index +
      (currentDropPosition.edge === "after" ? 1 : 0);
    const toIndex = Math.max(
      0,
      Math.min(
        editor.state.doc.childCount - 1,
        boundaryIndex > fromIndex ? boundaryIndex - 1 : boundaryIndex,
      ),
    );

    reorderEditorBlocks(editor, fromIndex, toIndex);
    finishBlockDrag();
    setBlockHandle(null);
  }

  function finishBlockDrag() {
    dragPreviewRef.current?.remove();
    dragPreviewRef.current = null;
    draggedBlockElementRef.current?.classList.remove("is-block-dragging");
    draggedBlockElementRef.current = null;
    draggedBlockIndexRef.current = null;
    dropPositionRef.current = null;
    setDropPosition(null);
    setIsDraggingBlock(false);
    window.setTimeout(() => {
      suppressBlockMenuClickRef.current = false;
    }, 0);
  }

  function handleBlockPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!blockHandle || event.button !== 0) return;

    const blockElement = editor?.view.dom.children[blockHandle.index];
    if (!(blockElement instanceof HTMLElement)) return;

    const blockRect = blockElement.getBoundingClientRect();
    pointerDragRef.current = {
      pointerId: event.pointerId,
      index: blockHandle.index,
      startX: event.clientX,
      startY: event.clientY,
      previewOffsetY: event.clientY - blockRect.top,
      started: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleBlockPointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    if (!pointerDrag.started) {
      const distance = Math.hypot(
        event.clientX - pointerDrag.startX,
        event.clientY - pointerDrag.startY,
      );
      if (distance < 5) return;

      pointerDrag.started = true;
      startBlockDrag(event.clientY);
    }

    event.preventDefault();
    updateBlockDrag(event.clientY);
  }

  function handleBlockPointerUp(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    pointerDragRef.current = null;

    if (pointerDrag.started) {
      event.preventDefault();
      dropBlock();
    }
  }

  function handleBlockPointerCancel(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (pointerDragRef.current?.pointerId !== event.pointerId) return;
    pointerDragRef.current = null;
    finishBlockDrag();
  }

  if (!isMounted) {
    return <div className="min-h-48" />;
  }

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        "notion-editor relative",
        !readOnly && "notion-editor-editable",
      )}
      onMouseMove={handleEditorMouseMove}
      onMouseLeave={() => {
        if (!isBlockMenuOpen && !isDraggingBlock) setBlockHandle(null);
      }}
    >
      {editor && blockHandle && !readOnly ? (
        <div
          className="notion-block-handle"
          style={{ top: blockHandle.top }}
        >
          <DropdownMenu
            open={isBlockMenuOpen}
            onOpenChange={(open) => {
              if (!open) setIsBlockMenuOpen(false);
            }}
          >
            <DropdownMenuTrigger asChild>
              <span
                className="notion-block-menu-anchor"
                aria-hidden="true"
              />
            </DropdownMenuTrigger>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="notion-block-handle-button"
              aria-label="Block actions"
              aria-haspopup="menu"
              aria-expanded={isBlockMenuOpen}
              title="Drag to Reorder or Click for Actions"
              onClick={() => {
                if (suppressBlockMenuClickRef.current) return;
                setIsBlockMenuOpen(true);
              }}
              onPointerDown={handleBlockPointerDown}
              onPointerMove={handleBlockPointerMove}
              onPointerUp={handleBlockPointerUp}
              onPointerCancel={handleBlockPointerCancel}
            >
              <GripVertical />
            </Button>
            <DropdownMenuContent side="left" align="start" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    deleteEditorBlock(editor, blockHandle.index);
                    setBlockHandle(null);
                  }}
                >
                  <Trash2 />
                  Delete Block
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      {dropPosition ? (
        <div
          className="notion-block-drop-indicator"
          style={{ top: dropPosition.top }}
        />
      ) : null}
      {editor && !readOnly ? (
        <TooltipProvider>
          <BubbleMenu
            editor={editor}
            pluginKey="formattingBubbleMenu"
            className="formatting-bubble"
            shouldShow={({ editor: currentEditor, state }) => {
              return shouldShowFormattingBubble({
                editor: currentEditor,
                selection: state.selection,
              });
            }}
          >
            <BubbleTooltipButton
              tooltip="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
            >
              <Bold className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
            >
              <Italic className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Strikethrough"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
            >
              <Strikethrough className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Inline Code"
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
            >
              <Code className="size-3.5" />
            </BubbleTooltipButton>
          <span className="separator" />
            <BubbleTooltipButton
              tooltip={editor.isActive("link") ? "Edit Link" : "Add Link"}
              onClick={setLink}
              isActive={editor.isActive("link")}
            >
              <Link className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Remove Link"
              onClick={removeLink}
              disabled={!editor.isActive("link")}
            >
              <Unlink className="size-3.5" />
            </BubbleTooltipButton>
          <span className="separator" />
            <BubbleTooltipButton
              tooltip="Heading 1"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              isActive={editor.isActive("heading", { level: 1 })}
            >
              <Heading1 className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Heading 2"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              isActive={editor.isActive("heading", { level: 2 })}
            >
              <Heading2 className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Heading 3"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              isActive={editor.isActive("heading", { level: 3 })}
            >
              <Heading3 className="size-3.5" />
            </BubbleTooltipButton>
          <span className="separator" />
            <BubbleTooltipButton
              tooltip="Bullet List"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
            >
              <List className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Ordered List"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
            >
              <ListOrdered className="size-3.5" />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Blockquote"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive("blockquote")}
            >
              <Quote className="size-3.5" />
            </BubbleTooltipButton>
          </BubbleMenu>

          <BubbleMenu
            editor={editor}
            pluginKey="tableBubbleMenu"
            className="table-bubble-menu"
            shouldShow={({ editor: currentEditor, state }) =>
              shouldShowTableBubble({
                editor: currentEditor,
                selection: state.selection,
              })
            }
          >
            <BubbleTooltipButton
              tooltip="Add Row Below"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <BetweenHorizontalStart />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Delete Row"
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <Rows3 />
            </BubbleTooltipButton>
            <span className="separator" />
            <BubbleTooltipButton
              tooltip="Add Column Right"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <BetweenVerticalStart />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Delete Column"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <Columns3 />
            </BubbleTooltipButton>
            <span className="separator" />
            <BubbleTooltipButton
              tooltip="Toggle Header Row"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            >
              <PanelTop />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Merge Selected Cells"
              onClick={() => editor.chain().focus().mergeCells().run()}
              disabled={!editor.can().mergeCells()}
            >
              <Merge />
            </BubbleTooltipButton>
            <BubbleTooltipButton
              tooltip="Split Cell"
              onClick={() => editor.chain().focus().splitCell().run()}
              disabled={!editor.can().splitCell()}
            >
              <SplitSquareVertical />
            </BubbleTooltipButton>
            <span className="separator" />
            <BubbleTooltipButton
              tooltip="Delete Table"
              className="is-destructive"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 />
            </BubbleTooltipButton>
          </BubbleMenu>
        </TooltipProvider>
      ) : null}
      <EditorContent editor={editor} />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadImage(file);
        }}
      />
      {isUploadingImage ? (
        <div className="notion-image-uploading" role="status">
          <LoaderCircle />
          Uploading image
        </div>
      ) : null}
    </div>
  );
}
