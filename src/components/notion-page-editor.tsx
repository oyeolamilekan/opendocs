import { useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Braces,
  ChevronDown,
  FileText,
  MoreHorizontal,
  Search,
  Smile,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NotionEditor } from "./notion-editor";
import {
  DOCUMENTATION_ICONS,
  DOCUMENTATION_ICON_NAMES,
  DocumentationIcon,
  type DocumentationIconName,
} from "../lib/documentation-icons";

interface PageEditorDraft {
  title: string;
  endpointType: "endpoint" | "doc";
  editorType: "api" | "notion";
  content: string;
  markdown: string;
  iconName?: string;
  body: {
    description: string;
  };
}

export function NotionPageEditor<TDraft extends PageEditorDraft>({
  projectId,
  draft,
  canManage,
  onChange,
  onTypeChange,
}: {
  projectId: Id<"apiProjects">;
  draft: TDraft;
  canManage: boolean;
  onChange: (draft: TDraft) => void;
  onTypeChange?: (endpointType: PageEditorDraft["endpointType"]) => void;
}) {
  const editorContent = useMemo(() => {
    if (!draft.content) return null;
    try {
      return JSON.parse(draft.content) as JSONContent;
    } catch {
      return null;
    }
  }, [draft.content]);

  return (
    <div className="notion-page mx-auto w-full max-w-[88rem]">
      <div className="notion-page-toolbar">
        {onTypeChange ? (
          <DocumentTypeMenu
            value={draft.endpointType}
            disabled={!canManage}
            onValueChange={onTypeChange}
          />
        ) : null}

        <IconPicker
          iconName={draft.iconName}
          disabled={!canManage}
          onChange={(iconName) => onChange({ ...draft, iconName } as TDraft)}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="More Page Actions"
          title="More Page Actions"
        >
          <MoreHorizontal />
        </Button>
      </div>

      <div className="notion-page-canvas">
        <input
          className="notion-page-title"
          value={draft.title}
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value } as TDraft)
          }
          placeholder="Untitled"
          disabled={!canManage}
          aria-label="Page title"
        />
        <textarea
          className="notion-page-description"
          value={draft.body.description}
          onChange={(event) =>
            onChange({
              ...draft,
              body: {
                ...draft.body,
                description: event.target.value,
              },
            } as TDraft)
          }
          placeholder="Add a short description"
          disabled={!canManage}
          aria-label="Page description"
          rows={1}
        />
        <div className="notion-page-divider" />

        <NotionEditor
          projectId={projectId}
          content={editorContent}
          readOnly={!canManage}
          onChange={(content) =>
            onChange({ ...draft, content: JSON.stringify(content) } as TDraft)
          }
        />
      </div>
    </div>
  );
}

export function DocumentTypeMenu({
  value,
  disabled,
  onValueChange,
}: {
  value: PageEditorDraft["endpointType"];
  disabled: boolean;
  onValueChange: (value: PageEditorDraft["endpointType"]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          {value === "endpoint" ? (
            <Braces className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
          {value === "endpoint" ? "Endpoint" : "Document"}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onValueChange("endpoint")}>
            <Braces className="size-4" />
            Endpoint
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onValueChange("doc")}>
            <FileText className="size-4" />
            Document
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconPicker({
  iconName,
  disabled,
  onChange,
}: {
  iconName?: string;
  disabled: boolean;
  onChange: (iconName?: DocumentationIconName) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return DOCUMENTATION_ICON_NAMES;
    return DOCUMENTATION_ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label="Page Icon"
          title="Page Icon"
        >
          {iconName ? (
            <DocumentationIcon iconName={iconName} fallback={Smile} />
          ) : (
            <Smile className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search icons"
              className="h-8 pl-8 text-sm"
            />
          </div>
          {iconName ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start"
              title="Remove Icon"
              onClick={() => onChange(undefined)}
            >
              <X className="size-4" />
              Remove Icon
            </Button>
          ) : null}
        </div>
        <div className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto p-1">
          {filtered.length > 0 ? (
            filtered.map((name) => {
              const Icon = DOCUMENTATION_ICONS[name as DocumentationIconName];
              const isActive = iconName === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChange(name as DocumentationIconName)}
                  title={name}
                  aria-label={name}
                  aria-pressed={isActive}
                  className={
                    "flex size-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" +
                    (isActive ? " bg-accent text-accent-foreground" : "")
                  }
                >
                  <Icon className="size-4" />
                </button>
              );
            })
          ) : (
            <p className="col-span-full px-2 py-6 text-center text-xs text-muted-foreground">
              No icons match your search.
            </p>
          )}
        </div>
        {iconName ? (
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onChange(undefined)}>
              <X />
              None
            </DropdownMenuItem>
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
