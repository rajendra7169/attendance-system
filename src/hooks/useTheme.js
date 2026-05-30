import { useEffect, useState } from "react";

const STORAGE_KEY = "tally:theme";

function resolveInitial() {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  // Fall back to OS preference on first visit.
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

// Reads / writes the active theme. Sets data-theme on <html> so CSS picks
// up the [data-theme="dark"] block. Persists explicit choices to
// localStorage; if the user never toggles, OS preference rules.
export function useTheme() {
  const [theme, setThemeState] = useState(resolveInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = (next) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggle };
}
