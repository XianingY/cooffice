import { getDesktop, type AppliedTheme, type ThemeSetting, type ThemeState } from "./desktop/bridge";

/**
 * Renderer-side theme controller.
 *
 * The desktop shell owns the setting (native chrome has to change too) and
 * pushes the resolved palette back here. In a browser tab there is no shell,
 * so the same three-way choice is stored locally and "system" tracks the CSS
 * media query. Both routes end at `data-theme` on <html>.
 */
const STORAGE_KEY = "whatif.theme";
const THEME_SETTINGS: ThemeSetting[] = ["system", "light", "dark"];

let current: ThemeState = { setting: "system", resolved: "light" };
const listeners = new Set<(state: ThemeState) => void>();

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function resolveTheme(setting: ThemeSetting, systemDark: boolean): AppliedTheme {
  if (setting === "system") return systemDark ? "dark" : "light";
  return setting;
}

export function normaliseTheme(value: unknown): ThemeSetting {
  return typeof value === "string" && THEME_SETTINGS.includes(value as ThemeSetting)
    ? (value as ThemeSetting)
    : "system";
}

export function currentTheme(): ThemeState {
  return current;
}

export function subscribeTheme(listener: (state: ThemeState) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

function apply(state: ThemeState): void {
  current = state;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = state.resolved;
    document.documentElement.style.colorScheme = state.resolved;
  }
  for (const listener of listeners) listener(state);
}

export async function setTheme(setting: ThemeSetting): Promise<ThemeState> {
  const next = normaliseTheme(setting);
  const bridge = getDesktop();
  if (bridge) {
    const state = await bridge.setTheme(next);
    apply(state);
    return state;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing still allows an in-memory switch.
  }
  apply({ setting: next, resolved: resolveTheme(next, prefersDark()) });
  return current;
}

/** Install listeners once; the returned function removes them on unmount. */
export function initTheme(): () => void {
  const bridge = getDesktop();
  if (bridge) {
    apply(bridge.getTheme());
    return bridge.onThemeChange((state) =>
      apply({
        setting: normaliseTheme(state.setting),
        resolved: state.resolved === "dark" ? "dark" : "light",
      }),
    );
  }

  let stored: ThemeSetting = "system";
  try {
    stored = normaliseTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Ignore inaccessible storage and follow the system.
  }
  apply({ setting: stored, resolved: resolveTheme(stored, prefersDark()) });

  const query =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const onSystemChange = () => {
    if (current.setting === "system") {
      apply({ setting: "system", resolved: prefersDark() ? "dark" : "light" });
    }
  };
  query?.addEventListener?.("change", onSystemChange);
  return () => query?.removeEventListener?.("change", onSystemChange);
}
