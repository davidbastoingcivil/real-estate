"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const STORAGE_KEY = "db-theme";

/** Inline script for <head>: applies the saved or system theme before first paint. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`;

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Dark / light switch. The new theme grows as a circle from the button
 * (View Transitions API where available, plain cross-fade otherwise).
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // The init script already set data-theme; read it once on mount.
    const frame = requestAnimationFrame(() => setTheme(currentTheme()));
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
      setTheme(next);
    };
    const rect = event.currentTarget.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${rect.left + rect.width / 2}px`);
    root.style.setProperty("--vt-y", `${rect.top + rect.height / 2}px`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown };
    if (!reduced && typeof doc.startViewTransition === "function") doc.startViewTransition(apply);
    else apply();
  }

  const label = theme === "light" ? "Activar modo oscuro" : "Activar modo claro";
  return <button type="button" className={`theme-toggle ${className}`} onClick={toggle} aria-label={label} title={label} data-theme-state={theme ?? "dark"}>
    <span className="theme-toggle-track" aria-hidden="true">
      <span className="theme-toggle-thumb">{theme === "light" ? <Sun size={14}/> : <Moon size={14}/>}</span>
    </span>
  </button>;
}
