import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const THEME_STORAGE_KEY = "minialdoc-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Theme =
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "system"
        ? savedTheme
        : "system";
    setThemeState(initialTheme);
    setResolvedTheme(applyTheme(initialTheme));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") setResolvedTheme(applyTheme("system"));
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  function setTheme(nextTheme: Theme) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export const themeInitializationScript = `
(() => {
  try {
    const saved = localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
    const dark = theme === "dark" ||
      (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {}
})();
`;
