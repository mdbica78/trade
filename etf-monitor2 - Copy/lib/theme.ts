/**
 * Theme resolution (DEC-020 §2, P-5). Pure module: no `window`/`document`
 * access at import time. Every storage/matchMedia access is inside
 * try/catch, since a browser may block storage or lack matchMedia.
 */

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "etf-theme";
/** P-5 isolated default: dark when neither a stored choice nor a browser preference exists. */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readStoredTheme(getStorage: () => StorageLike): Theme | null {
  try {
    const storage = getStorage();
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(getStorage: () => StorageLike, theme: Theme): void {
  try {
    const storage = getStorage();
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage blocked or throwing — the choice just isn't remembered
  }
}

export function readSystemPreference(matchMedia?: (query: string) => { matches: boolean }): Theme | null {
  if (!matchMedia) return null;
  try {
    if (matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    if (matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return null;
  } catch {
    return null;
  }
}

export function resolveTheme(stored: unknown, preference: Theme | null): Theme {
  if (isTheme(stored)) return stored;
  if (preference) return preference;
  return DEFAULT_THEME;
}

export function nextTheme(currentAttr: string | null | undefined): Theme {
  return currentAttr === "dark" ? "light" : "dark";
}

export function toggleTheme({
  root,
  getStorage,
}: {
  root: { getAttribute(name: string): string | null; setAttribute(name: string, value: string): void };
  getStorage: () => StorageLike;
}): Theme {
  const current = root.getAttribute("data-theme");
  const next = nextTheme(current);
  root.setAttribute("data-theme", next);
  writeStoredTheme(getStorage, next);
  return next;
}

/**
 * Hand-written IIFE run inline, before first paint, in app/layout.tsx.
 * Its only interpolations are JSON.stringify()'d constants from this
 * module — no user data, so there is no injection surface. It mirrors
 * resolveTheme()'s behaviour exactly (proven by lib/theme.test.ts TH-8).
 */
export const THEME_INIT_SCRIPT = `(function () {
  var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var DEFAULT = ${JSON.stringify(DEFAULT_THEME)};
  var stored = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch (e) {}
  var theme = null;
  if (stored === "light" || stored === "dark") {
    theme = stored;
  } else {
    var preference = null;
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) preference = "dark";
      else if (window.matchMedia("(prefers-color-scheme: light)").matches) preference = "light";
    } catch (e) {}
    theme = preference || DEFAULT;
  }
  document.documentElement.setAttribute("data-theme", theme);
})();`;
