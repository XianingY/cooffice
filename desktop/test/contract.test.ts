import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IPC } from "../src/shared/contract.js";

/**
 * The preload runs in a sandbox and cannot require sibling files, so its
 * channel names are literals. This test is what keeps the two halves honest.
 */
describe("preload/main contract", () => {
  const source = readFileSync(join(__dirname, "..", "src", "preload", "index.ts"), "utf8");
  const preloadChannels = new Set([...source.matchAll(/"(desktop:[a-z-]+)"/g)].map((match) => match[1]));

  it("declares every main-process channel in the preload", () => {
    const missing = Object.values(IPC).filter((channel) => !preloadChannels.has(channel));
    expect(missing).toEqual([]);
  });

  it("has no stale channels left in the preload", () => {
    const known = new Set<string>(Object.values(IPC));
    const extra = [...preloadChannels].filter((channel) => !known.has(channel));
    expect(extra).toEqual([]);
  });

  it("exposes one bridge method per capability", () => {
    for (const method of [
      "saveFile",
      "openProject",
      "openSpreadsheet",
      "revealPath",
      "getSessionToken",
      "getTheme",
      "setTheme",
      "onThemeChange",
      "onMenuAction",
    ]) {
      expect(source).toContain(`${method}:`);
    }
    expect(source).toContain("contextBridge.exposeInMainWorld(\"desktop\"");
  });
});
