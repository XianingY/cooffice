import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME, ThemeStore, normaliseTheme, resolveTheme } from "../src/main/theme.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "whatif-theme-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("theme helpers", () => {
  it("accepts only the three supported settings", () => {
    expect(normaliseTheme("dark")).toBe("dark");
    expect(normaliseTheme("system")).toBe("system");
    expect(normaliseTheme("auto")).toBe(DEFAULT_THEME);
    expect(normaliseTheme(undefined)).toBe(DEFAULT_THEME);
  });

  it("lets Electron resolve the system setting", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });
});

describe("theme store", () => {
  it("defaults to following the system when no file exists", () => {
    const store = new ThemeStore(join(dir, "missing", "theme.json"));
    expect(store.get()).toBe("system");
  });

  it("persists a valid setting and reloads it", () => {
    const file = join(dir, "nested", "theme.json");
    const store = new ThemeStore(file);
    expect(store.set("dark")).toBe("dark");
    expect(JSON.parse(readFileSync(file, "utf8"))).toBe("dark");
    expect(new ThemeStore(file).get()).toBe("dark");
  });

  it("falls back on a corrupted preference", () => {
    const file = join(dir, "theme.json");
    writeFileSync(file, "{not json");
    expect(new ThemeStore(file).get()).toBe("system");
    writeFileSync(file, '"turbo"');
    expect(new ThemeStore(file).get()).toBe("system");
  });
});
