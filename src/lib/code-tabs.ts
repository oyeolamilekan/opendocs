export type CodeTab = {
  id: string;
  name: string;
  language: string;
  code: string;
};

export const codeLanguages = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Shell" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "sql", label: "SQL" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
] as const;

export function defaultTabName(index: number) {
  return index === 0 ? "Example" : `Example ${index + 1}`;
}

function makeTab(index: number, id = `code-tab-${index}`): CodeTab {
  return {
    id,
    name: defaultTabName(index),
    language: "javascript",
    code: "",
  };
}

export function createInitialCodeTabs(): CodeTab[] {
  return [makeTab(0)];
}

export function normalizeCodeTabs(value: unknown): CodeTab[] {
  if (!Array.isArray(value) || value.length === 0) {
    return createInitialCodeTabs();
  }

  const tabs = value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const tab = candidate as Partial<CodeTab>;
    return [
      {
        id:
          typeof tab.id === "string" && tab.id
            ? tab.id
            : `code-tab-stored-${index}`,
        name: typeof tab.name === "string" ? tab.name : defaultTabName(index),
        language:
          typeof tab.language === "string" && tab.language
            ? tab.language
            : "plaintext",
        code: typeof tab.code === "string" ? tab.code : "",
      },
    ];
  });

  return tabs.length > 0 ? tabs : createInitialCodeTabs();
}
