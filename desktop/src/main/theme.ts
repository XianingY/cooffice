import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AppliedTheme, ThemeSetting } from "../shared/contract.js";

export const DEFAULT_THEME: ThemeSetting = "system";

/** Accept only the three values the menu can actually produce. */
export function normaliseTheme(value: unknown): ThemeSetting {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_THEME;
}

/** "system" is resolved by Electron so native UI and CSS agree. */
export function resolveTheme(setting: ThemeSetting, prefersDark: boolean): AppliedTheme {
  if (setting === "system") return prefersDark ? "dark" : "light";
  return setting;
}

/**
 * One small JSON value in the profile directory. Persisting must never break a
 * theme switch, so a read-only profile simply loses the preference on restart.
 */
export class ThemeStore {
  constructor(private readonly file: string) {}

  get(): ThemeSetting {
    try {
      return normaliseTheme(JSON.parse(readFileSync(this.file, "utf8")));
    } catch {
      return DEFAULT_THEME;
    }
  }

  set(setting: ThemeSetting): ThemeSetting {
    const next = normaliseTheme(setting);
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(next), "utf8");
    } catch {
      // Keep the in-memory selection even when the profile is read-only.
    }
    return next;
  }
}
