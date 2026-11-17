import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecentFilesStore } from "../src/main/recentFiles.js";

let dir: string;
let store: RecentFilesStore;

function project(name: string): string {
  const path = join(dir, name);
  writeFileSync(path, "{}");
  return path;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "whatif-recent-"));
  store = new RecentFilesStore(join(dir, "recent.json"), 3);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("recent files", () => {
  it("starts empty and survives a missing file", () => {
    expect(store.list()).toEqual([]);
  });

  it("keeps the newest entry first without duplicates", () => {
    const a = project("a.json");
    const b = project("b.json");
    store.add(a);
    store.add(b);
    store.add(a);
    expect(store.list()).toEqual([a, b]);
  });

  it("caps the list at the configured limit", () => {
    const files = ["a", "b", "c", "d"].map((name) => project(`${name}.json`));
    files.forEach((file) => store.add(file));
    expect(store.list()).toHaveLength(3);
    expect(store.list()[0]).toBe(files[3]);
  });

  it("drops entries that no longer exist on disk", () => {
    const a = project("gone.json");
    store.add(a);
    rmSync(a);
    expect(store.list()).toEqual([]);
  });

  it("removes and clears explicitly", () => {
    const a = project("a.json");
    const b = project("b.json");
    store.add(a);
    store.add(b);
    expect(store.remove(b)).toEqual([a]);
    store.clear();
    expect(store.list()).toEqual([]);
  });
});
