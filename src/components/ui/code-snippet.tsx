import { useMemo } from "react";

export type CodeSnippetLanguage =
  | "javascript"
  | "python"
  | "ruby"
  | "json"
  | "curl"
  | "text";

type TokenType =
  | "keyword"
  | "string"
  | "number"
  | "function"
  | "property"
  | "variable"
  | "operator"
  | "punctuation"
  | "comment"
  | "plain";

type Token = {
  text: string;
  type: TokenType;
};

type LanguageConfig = {
  keywords: Set<string>;
  operators: string[];
  comment?: string;
  options?: Set<string>;
  commands?: Set<string>;
};

const tokenClasses: Record<TokenType, string> = {
  keyword: "code-token-keyword",
  string: "code-token-string",
  number: "code-token-number",
  function: "code-token-function",
  property: "code-token-property",
  variable: "code-token-variable",
  operator: "code-token-operator",
  punctuation: "code-token-muted",
  comment: "code-token-comment",
  plain: "code-token-plain",
};

const languageConfigs: Record<CodeSnippetLanguage, LanguageConfig> = {
  javascript: {
    keywords: new Set([
      "async",
      "await",
      "break",
      "catch",
      "class",
      "const",
      "continue",
      "else",
      "export",
      "false",
      "finally",
      "for",
      "function",
      "if",
      "import",
      "let",
      "new",
      "null",
      "return",
      "throw",
      "true",
      "try",
      "undefined",
      "var",
      "while",
    ]),
    operators: [
      "===",
      "!==",
      "=>",
      "==",
      "!=",
      ">=",
      "<=",
      "&&",
      "||",
      "++",
      "--",
      "+=",
      "-=",
      "*=",
      "/=",
      "+",
      "-",
      "*",
      "/",
      "=",
      "!",
      "<",
      ">",
      "?",
      ":",
    ],
    comment: "//",
  },
  python: {
    keywords: new Set([
      "and",
      "as",
      "class",
      "def",
      "elif",
      "else",
      "False",
      "for",
      "from",
      "if",
      "import",
      "in",
      "is",
      "None",
      "not",
      "or",
      "return",
      "True",
      "while",
      "with",
    ]),
    operators: [
      "**",
      "//",
      "==",
      "!=",
      ">=",
      "<=",
      "+=",
      "-=",
      "*=",
      "/=",
      "+",
      "-",
      "*",
      "/",
      "=",
      "<",
      ">",
      ":",
      "%",
    ],
    comment: "#",
  },
  ruby: {
    keywords: new Set([
      "begin",
      "case",
      "class",
      "def",
      "do",
      "else",
      "elsif",
      "end",
      "false",
      "for",
      "if",
      "module",
      "new",
      "nil",
      "require",
      "rescue",
      "return",
      "self",
      "true",
      "unless",
      "until",
      "when",
      "while",
      "yield",
    ]),
    operators: [
      "...",
      "**",
      "<<",
      ">>",
      "&&",
      "||",
      "==",
      "!=",
      ">=",
      "<=",
      "..",
      "+",
      "-",
      "*",
      "/",
      "=",
      "<",
      ">",
      "%",
      "|",
    ],
    comment: "#",
  },
  curl: {
    keywords: new Set(["curl"]),
    operators: ["\\", "="],
    options: new Set([
      "-X",
      "--request",
      "-H",
      "--header",
      "-d",
      "--data",
      "--data-raw",
      "--data-binary",
      "-F",
      "--form",
      "-u",
      "--user",
    ]),
    commands: new Set([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ]),
  },
  json: {
    keywords: new Set(["true", "false", "null"]),
    operators: [],
  },
  text: {
    keywords: new Set(),
    operators: [],
  },
};

const punctuation = new Set(["{", "}", "[", "]", "(", ")", ",", ";", "."]);

export function formatCode(code: string) {
  const lines = code.replace(/\r\n?/g, "\n").split("\n");

  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();

  const indentation = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^[\t ]*/)?.[0].length ?? 0);
  const commonIndent = indentation.length ? Math.min(...indentation) : 0;

  return lines
    .map((line) => line.slice(commonIndent).replace(/\t/g, "  ").trimEnd())
    .join("\n");
}

function tokenizeLine(line: string, language: CodeSnippetLanguage): Token[] {
  if (language === "text") {
    return [{ text: line, type: "plain" }];
  }

  const config = languageConfigs[language];
  const tokens: Token[] = [];
  let current = 0;

  while (current < line.length) {
    if (config.comment && line.startsWith(config.comment, current)) {
      tokens.push({ text: line.slice(current), type: "comment" });
      break;
    }

    const char = line[current];

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let end = current + 1;

      while (end < line.length) {
        if (line[end] === "\\" && end + 1 < line.length) {
          end += 2;
          continue;
        }
        if (line[end] === quote) {
          end += 1;
          break;
        }
        end += 1;
      }

      const text = line.slice(current, end);
      const remaining = line.slice(end);
      const isJsonKey =
        (language === "json" ||
          language === "javascript" ||
          language === "python" ||
          language === "ruby") &&
        remaining.trimStart().startsWith(":");
      tokens.push({ text, type: isJsonKey ? "property" : "string" });
      current = end;
      continue;
    }

    const numberMatch = line
      .slice(current)
      .match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      tokens.push({ text: numberMatch[0], type: "number" });
      current += numberMatch[0].length;
      continue;
    }

    const wordMatch = line
      .slice(current)
      .match(
        language === "curl"
          ? /^(?:-{1,2}[A-Za-z][\w-]*|[A-Za-z_][\w-]*)/
          : /^[A-Za-z_$@][\w$@]*/,
      );
    if (wordMatch) {
      const text = wordMatch[0];
      const remaining = line.slice(current + text.length).trimStart();
      const nextCharacter = remaining[0];
      let type: TokenType = "variable";

      if (config.keywords.has(text)) type = "keyword";
      else if (config.options?.has(text)) type = "function";
      else if (config.commands?.has(text)) type = "operator";
      else if (nextCharacter === ":") type = "property";
      else if (nextCharacter === "(") type = "function";
      else if (language === "curl") type = "plain";

      tokens.push({ text, type });
      current += text.length;
      continue;
    }

    const operator = config.operators.find((value) =>
      line.startsWith(value, current),
    );
    if (operator) {
      tokens.push({ text: operator, type: "operator" });
      current += operator.length;
      continue;
    }

    if (punctuation.has(char) || (language === "json" && char === ":")) {
      tokens.push({ text: char, type: "punctuation" });
      current += 1;
      continue;
    }

    tokens.push({ text: char, type: "plain" });
    current += 1;
  }

  return tokens;
}

export function CodeSnippet({
  code,
  language,
  wrap = false,
}: {
  code: string;
  language: CodeSnippetLanguage;
  wrap?: boolean;
}) {
  const formattedCode = useMemo(() => formatCode(code), [code]);
  const lines = useMemo(
    () =>
      formattedCode
        .split("\n")
        .map((line) => tokenizeLine(line, language)),
    [formattedCode, language],
  );

  return (
    <pre
      className={`code-snippet m-0 max-h-[30rem] overflow-auto py-3 font-mono text-[13px] leading-6 [font-variant-ligatures:none] [tab-size:2] ${
        wrap ? "code-snippet-wrap overflow-x-hidden" : ""
      }`}
      aria-label={`${language} code sample`}
    >
      <code className={wrap ? "block min-w-full" : "block w-max min-w-full"}>
        {lines.map((tokens, lineIndex) => (
          <span
            key={`${lineIndex}-${tokens.length}`}
            className={`code-snippet-line grid min-w-full ${
              wrap
                ? "grid-cols-[3.5rem_minmax(0,1fr)]"
                : "grid-cols-[3.5rem_minmax(max-content,1fr)]"
            }`}
          >
            <span
              aria-hidden="true"
              className="code-snippet-line-number sticky left-0 border-r pr-3 text-right"
            >
              {lineIndex + 1}
            </span>
            <span
              className={
                wrap
                  ? "whitespace-pre-wrap break-words px-4"
                  : "whitespace-pre px-4"
              }
            >
              {tokens.length
                ? tokens.map((token, tokenIndex) => (
                    <span
                      key={`${tokenIndex}-${token.text}`}
                      className={tokenClasses[token.type]}
                    >
                      {token.text}
                    </span>
                  ))
                : " "}
            </span>
          </span>
        ))}
      </code>
    </pre>
  );
}
