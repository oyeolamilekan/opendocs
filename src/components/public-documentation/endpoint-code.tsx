import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { CodeSnippet, formatCode, type CodeSnippetLanguage } from "../ui/code-snippet";
import { responseBodyCode } from "./markdown";
import { copyTextToClipboard } from "./clipboard";
import { Button } from "../ui/button";

export function ResponseBodyCode({ code }: { code: string }) {
  const snippet = useMemo(() => responseBodyCode(code), [code]);

  return (
    <div className="code-sample response-code-sample border-t">
      <CodeSnippet code={snippet.code} language={snippet.language} wrap />
    </div>
  );
}

export function CodePanel({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const snippetLanguage: CodeSnippetLanguage =
    language === "JavaScript"
      ? "javascript"
      : language === "Python"
        ? "python"
        : language === "Ruby"
          ? "ruby"
          : "curl";

  async function copyCode() {
    await copyTextToClipboard(formatCode(code));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="code-sample overflow-hidden rounded-lg border">
      <div className="code-sample-toolbar flex min-h-12 items-center justify-between gap-4 border-b px-5 py-3">
        <span className="code-sample-muted text-xs">{language} request</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="code-sample-copy"
          onClick={() => void copyCode()}
          aria-label={`Copy ${language} example`}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <CodeSnippet code={code} language={snippetLanguage} />
    </div>
  );
}
