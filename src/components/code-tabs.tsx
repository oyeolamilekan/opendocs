import {
  createElement,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
} from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { Check, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  codeLanguages,
  defaultTabName,
  normalizeCodeTabs,
  type CodeTab,
} from "../lib/code-tabs";
import { cn } from "../lib/utils";

const lowlight = createLowlight({
  bash,
  cpp,
  csharp,
  css,
  go,
  java,
  javascript,
  json,
  markdown,
  php,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
});

const languageAliases: Record<string, string> = {
  html: "xml",
  jsx: "javascript",
  plaintext: "text",
  tsx: "typescript",
};

function makeNewTab(index: number, id: string): CodeTab {
  return {
    id,
    name: defaultTabName(index),
    language: "javascript",
    code: "",
  };
}

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function renderHast(node: HastNode, key: number | string): ReactNode {
  if (node.type === "text") return node.value ?? "";
  if (node.type !== "element" || !node.tagName) return null;

  const classValue = node.properties?.className;
  const className = Array.isArray(classValue)
    ? classValue.join(" ")
    : typeof classValue === "string"
      ? classValue
      : undefined;

  return createElement(
    node.tagName,
    { key, className },
    node.children?.map((child, index) => renderHast(child, index)),
  );
}

function HighlightedCode({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const highlighted = useMemo(() => {
    const resolvedLanguage = languageAliases[language] ?? language;
    if (resolvedLanguage === "text" || !lowlight.registered(resolvedLanguage)) {
      return null;
    }

    try {
      return lowlight.highlight(resolvedLanguage, code);
    } catch {
      return null;
    }
  }, [code, language]);

  if (!highlighted) return <>{code}</>;
  return (
    <>
      {(highlighted.children as HastNode[]).map((node, index) =>
        renderHast(node, index),
      )}
    </>
  );
}

function LineNumbers({ code }: { code: string }) {
  const lineCount = Math.max(1, code.split("\n").length);
  return (
    <span className="code-tabs-line-numbers" aria-hidden="true">
      {Array.from({ length: lineCount }, (_, index) => (
        <span key={index}>{index + 1}</span>
      ))}
    </span>
  );
}

function CodePanel({
  tab,
  editable,
  onChange,
}: {
  tab: CodeTab;
  editable: boolean;
  onChange?: (code: string) => void;
}) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineCount = Math.max(2, tab.code.split("\n").length);

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }

  return (
    <div
      className="code-tabs-panel"
      style={{ "--code-lines": lineCount } as CSSProperties}
    >
      <LineNumbers code={tab.code} />
      <pre
        ref={highlightRef}
        className="code-tabs-highlight"
        aria-hidden={editable}
      >
        <code>
          <HighlightedCode code={tab.code} language={tab.language} />
          {tab.code.endsWith("\n") ? " " : null}
        </code>
      </pre>
      {editable ? (
        <textarea
          className="code-tabs-textarea"
          value={tab.code}
          onChange={(event) => onChange?.(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            const input = event.currentTarget;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const nextCode = `${tab.code.slice(0, start)}  ${tab.code.slice(end)}`;
            onChange?.(nextCode);
            window.requestAnimationFrame(() => {
              input.selectionStart = input.selectionEnd = start + 2;
            });
          }}
          aria-label={`${tab.name} code`}
          spellCheck={false}
        />
      ) : null}
    </div>
  );
}

function CodeTabsToolbar({
  tabs,
  activeId,
  onSelect,
  actions,
  publicView = false,
}: {
  tabs: CodeTab[];
  activeId: string;
  onSelect: (id: string) => void;
  actions?: ReactNode;
  publicView?: boolean;
}) {
  return (
    <div className="code-tabs-toolbar">
      <div className="code-tabs-tab-list" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            className={cn("code-tabs-tab", tab.id === activeId && "is-active")}
            onClick={() => onSelect(tab.id)}
          >
            <span className="code-tabs-tab-label">
              {tab.name || defaultTabName(index)}
            </span>
            {!publicView && tab.id === activeId ? <ChevronDown /> : null}
          </button>
        ))}
      </div>
      {actions}
    </div>
  );
}

function CodeTabSettings({
  tab,
  defaultName,
  canDelete,
  onUpdate,
  onDelete,
}: {
  tab: CodeTab;
  defaultName: string;
  canDelete: boolean;
  onUpdate: (patch: Partial<CodeTab>) => void;
  onDelete: () => void;
}) {
  return (
    <PopoverContent align="start" className="code-tabs-settings">
      <label>
        <span>Syntax highlighting</span>
        <Select
          value={tab.language}
          onValueChange={(language) => onUpdate({ language })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {codeLanguages.map((language) => (
              <SelectItem key={language.value} value={language.value}>
                {language.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label>
        <span>Tab name</span>
        <Input
          value={tab.name}
          placeholder={defaultName}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </label>
      <Button
        type="button"
        variant="destructive"
        className="justify-start"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <Trash2 data-icon="inline-start" />
        Delete tab
      </Button>
    </PopoverContent>
  );
}

export function CodeTabsNodeView({
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const tabs = normalizeCodeTabs(node.attrs.tabs);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const generatedTabCountRef = useRef(0);
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  function updateTabs(nextTabs: CodeTab[]) {
    updateAttributes({ tabs: nextTabs });
  }

  function updateActive(patch: Partial<CodeTab>) {
    updateTabs(
      tabs.map((tab) => (tab.id === activeTab.id ? { ...tab, ...patch } : tab)),
    );
  }

  function addTab() {
    generatedTabCountRef.current += 1;
    const nextTab = makeNewTab(
      tabs.length,
      `code-tab-new-${tabs.length}-${generatedTabCountRef.current}`,
    );
    updateTabs([...tabs, nextTab]);
    setActiveId(nextTab.id);
  }

  function deleteTab(tabId = activeTab.id) {
    if (tabs.length === 1) return;
    const activeIndex = tabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = tabs.filter((tab) => tab.id !== tabId);
    updateTabs(nextTabs);
    setActiveId(nextTabs[Math.max(0, activeIndex - 1)].id);
  }

  return (
    <NodeViewWrapper
      className="code-tabs code-tabs-editor"
      data-code-tabs=""
      contentEditable={false}
    >
      <div className="code-tabs-toolbar">
        <div className="code-tabs-tab-list" role="tablist">
          {tabs.map((tab, index) => {
            const displayName = tab.name || defaultTabName(index);
            return (
              <div
                key={tab.id}
                className={cn(
                  "code-tabs-editor-tab",
                  tab.id === activeTab.id && "is-active",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.id === activeTab.id}
                  className="code-tabs-tab"
                  onClick={() => setActiveId(tab.id)}
                >
                  <span className="code-tabs-tab-label">{displayName}</span>
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="code-tabs-tab-settings"
                      onClick={() => setActiveId(tab.id)}
                      aria-label={`Configure ${displayName}`}
                      title={`Configure ${displayName}`}
                    >
                      <ChevronDown />
                    </button>
                  </PopoverTrigger>
                  <CodeTabSettings
                    tab={tab}
                    defaultName={defaultTabName(index)}
                    canDelete={tabs.length > 1}
                    onUpdate={(patch) => {
                      updateTabs(
                        tabs.map((item) =>
                          item.id === tab.id ? { ...item, ...patch } : item,
                        ),
                      );
                    }}
                    onDelete={() => deleteTab(tab.id)}
                  />
                </Popover>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="code-tabs-add"
          onClick={addTab}
          aria-label="Add Code Tab"
          title="Add Code Tab"
        >
          <Plus />
        </button>
      </div>
      <CodePanel
        tab={activeTab}
        editable
        onChange={(code) => updateActive({ code })}
      />
    </NodeViewWrapper>
  );
}

export function PublicCodeTabs({ tabs: value }: { tabs: unknown }) {
  const tabs = useMemo(() => normalizeCodeTabs(value), [value]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [copied, setCopied] = useState(false);
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  async function copyCode() {
    await navigator.clipboard.writeText(activeTab.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="code-tabs code-tabs-public">
      <CodeTabsToolbar
        tabs={tabs}
        activeId={activeTab.id}
        onSelect={setActiveId}
        publicView
        actions={
          <button
            type="button"
            className="code-tabs-copy"
            onClick={() => void copyCode()}
            aria-label={copied ? "Code copied" : "Copy code"}
            title={copied ? "Copied" : "Copy code"}
          >
            {copied ? <Check /> : <Copy />}
          </button>
        }
      />
      <CodePanel tab={activeTab} editable={false} />
    </div>
  );
}
