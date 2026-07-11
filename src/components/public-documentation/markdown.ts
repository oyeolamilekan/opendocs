import type { CodeSnippetLanguage } from "../ui/code-snippet";

export function appendCodeExamplesMarkdown(
  markdown: string,
  examples: Record<string, string>,
) {
  const entries = Object.entries(examples);
  if (!entries.length) return markdown;

  const codeExamples = entries
    .map(
      ([language, code]) =>
        `### ${language}\n\n\`\`\`${codeFenceLanguage(language)}\n${code.trim()}\n\`\`\``,
    )
    .join("\n\n");

  return `${markdown.trim()}\n\n## Code examples\n\n${codeExamples}\n`;
}

export function codeFenceLanguage(language: string) {
  if (language === "JavaScript") return "javascript";
  if (language === "Python") return "python";
  if (language === "Ruby") return "ruby";
  if (language === "cURL") return "bash";
  return "txt";
}

export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\|[-:| ]+\|\n?/gm, "")
    .replace(/^\|(.+)\|$/gm, (_, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" - "),
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function responseBodyCode(value: string): {
  code: string;
  language: CodeSnippetLanguage;
} {
  try {
    return {
      code: JSON.stringify(JSON.parse(value), null, 2),
      language: "json",
    };
  } catch {
    return { code: value, language: "text" };
  }
}
