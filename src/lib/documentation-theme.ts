export const DOCUMENTATION_THEMES = [
  {
    value: "emerald",
    label: "Emerald",
    primary: "oklch(0.42 0.095 164)",
    ring: "oklch(0.52 0.105 164)",
    darkPrimary: "oklch(0.72 0.14 164)",
    darkRing: "oklch(0.65 0.12 164)",
  },
  {
    value: "blue",
    label: "Blue",
    primary: "oklch(0.488 0.243 264.376)",
    ring: "oklch(0.623 0.214 259.815)",
    darkPrimary: "oklch(0.707 0.165 254.624)",
    darkRing: "oklch(0.623 0.214 259.815)",
  },
  {
    value: "violet",
    label: "Violet",
    primary: "oklch(0.491 0.27 292.581)",
    ring: "oklch(0.606 0.25 292.717)",
    darkPrimary: "oklch(0.702 0.183 293.541)",
    darkRing: "oklch(0.606 0.25 292.717)",
  },
  {
    value: "rose",
    label: "Rose",
    primary: "oklch(0.455 0.188 13.697)",
    ring: "oklch(0.586 0.253 17.585)",
    darkPrimary: "oklch(0.712 0.194 13.428)",
    darkRing: "oklch(0.645 0.246 16.439)",
  },
  {
    value: "orange",
    label: "Orange",
    primary: "oklch(0.553 0.195 38.402)",
    ring: "oklch(0.646 0.222 41.116)",
    darkPrimary: "oklch(0.75 0.183 55.934)",
    darkRing: "oklch(0.705 0.213 47.604)",
  },
  {
    value: "slate",
    label: "Slate",
    primary: "oklch(0.372 0.044 257.287)",
    ring: "oklch(0.554 0.046 257.417)",
    darkPrimary: "oklch(0.704 0.04 256.788)",
    darkRing: "oklch(0.554 0.046 257.417)",
  },
] as const;

export type DocumentationThemeColor =
  (typeof DOCUMENTATION_THEMES)[number]["value"];

export const DEFAULT_DOCUMENTATION_THEME_COLOR: DocumentationThemeColor =
  "emerald";

export const DOCUMENTATION_STYLES = [
  {
    value: "default",
    label: "Default",
    description: "Balanced spacing for API references and guides.",
  },
  {
    value: "compact",
    label: "Compact",
    description: "Denser navigation and content spacing.",
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Larger headings and roomier long-form guides.",
  },
] as const;

export type DocumentationStyle = (typeof DOCUMENTATION_STYLES)[number]["value"];
export const DEFAULT_DOCUMENTATION_STYLE: DocumentationStyle = "default";

export const DOCUMENTATION_FONTS = [
  {
    value: "sans",
    label: "Sans",
    description: "Clean product documentation typography.",
    family: '"Geist", system-ui, sans-serif',
  },
  {
    value: "serif",
    label: "Serif",
    description: "Editorial reading style for long-form docs.",
    family: 'Georgia, "Times New Roman", serif',
  },
  {
    value: "mono",
    label: "Mono",
    description: "Technical, code-forward presentation.",
    family: '"Geist Mono", monospace',
  },
  {
    value: "inter",
    label: "Inter",
    description: "Neutral interface typography with strong readability.",
    family: '"Inter", "Geist", system-ui, sans-serif',
  },
  {
    value: "roboto",
    label: "Roboto",
    description: "Familiar material-style documentation typography.",
    family: '"Roboto", "Geist", system-ui, sans-serif',
  },
  {
    value: "open-sans",
    label: "Open Sans",
    description: "Warm, approachable prose for guides and references.",
    family: '"Open Sans", "Geist", system-ui, sans-serif',
  },
  {
    value: "lato",
    label: "Lato",
    description: "Humanist sans with a polished editorial tone.",
    family: '"Lato", "Geist", system-ui, sans-serif',
  },
  {
    value: "ibm-plex-sans",
    label: "IBM Plex Sans",
    description: "Structured technical typography for product docs.",
    family: '"IBM Plex Sans", "Geist", system-ui, sans-serif',
  },
  {
    value: "merriweather",
    label: "Merriweather",
    description: "Readable serif for long-form documentation.",
    family: '"Merriweather", Georgia, "Times New Roman", serif',
  },
  {
    value: "source-serif-4",
    label: "Source Serif 4",
    description: "Refined serif with strong article readability.",
    family: '"Source Serif 4", Georgia, "Times New Roman", serif',
  },
  {
    value: "jetbrains-mono",
    label: "JetBrains Mono",
    description: "Code-oriented monospace for technical references.",
    family: '"JetBrains Mono", "Geist Mono", monospace',
  },
] as const;

export type DocumentationFont = (typeof DOCUMENTATION_FONTS)[number]["value"];
export const DEFAULT_DOCUMENTATION_FONT: DocumentationFont = "sans";

const GOOGLE_FONT_FAMILIES: Partial<Record<DocumentationFont, string>> = {
  inter: "Inter:wght@400;500;600;700",
  roboto: "Roboto:wght@400;500;700",
  "open-sans": "Open+Sans:wght@400;500;600;700",
  lato: "Lato:wght@400;700",
  "ibm-plex-sans": "IBM+Plex+Sans:wght@400;500;600;700",
  merriweather: "Merriweather:wght@400;700",
  "source-serif-4": "Source+Serif+4:wght@400;500;600;700",
  "jetbrains-mono": "JetBrains+Mono:wght@400;500;600;700",
};

export function getDocumentationFontUrl(font: DocumentationFont) {
  const family = GOOGLE_FONT_FAMILIES[font];
  return family
    ? `https://fonts.googleapis.com/css2?family=${family}&display=swap`
    : null;
}

/**
 * Returns the configured documentation font option or the default font.
 *
 * @param [value] - Input value to process.
 * @returns Result produced by the function.
 */
export const getDocumentationFont = (value?: string) => {
  return (
    DOCUMENTATION_FONTS.find((font) => font.value === value) ??
    DOCUMENTATION_FONTS[0]
  );
};

/**
 * Returns the configured documentation theme color option or the default theme.
 *
 * @param [value] - Input value to process.
 * @returns Result produced by the function.
 */
export const getDocumentationTheme = (value?: string) => {
  return (
    DOCUMENTATION_THEMES.find((theme) => theme.value === value) ??
    DOCUMENTATION_THEMES[0]
  );
};

/**
 * Checks whether a string is a supported hexadecimal brand color.
 *
 * @param value - Input value to process.
 * @returns Result produced by the function.
 */
export const isValidBrandColor = (value: string) => {
  return /^#[0-9a-fA-F]{6}$/.test(value);
};
