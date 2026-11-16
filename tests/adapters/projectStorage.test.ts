import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import type { ProjectSnapshot } from "../../src/core/types";
import { clearProject, loadProject, saveProject, STORAGE_KEY } from "../../src/adapters/storage/projectStorage";

const snapshot = (): ProjectSnapshot => ({
  schemaVersion: 1,
  baseline: salesDemo,
  draft: salesDemo,
  updatedAt: new Date().toISOString(),
});

describe("projectStorage", () => {
  it("round-trips a versioned snapshot and clears it", () => {
    saveProject(snapshot());
    expect(loadProject()?.draft).toEqual(salesDemo);
    expect(loadProject()?.baseline).toEqual(salesDemo);
    clearProject();
    expect(loadProject()).toBeNull();
  });

  it("uses the confirmed storage key and stores only snapshot fields", () => {
    expect(STORAGE_KEY).toBe("what-if-report:project:v1");
    saveProject(snapshot());
    const raw = localStorage.getItem(STORAGE_KEY)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["baseline", "draft", "schemaVersion", "updatedAt"]);
  });

  it("returns null when the key is absent", () => {
    expect(loadProject()).toBeNull();
  });

  it("rejects malformed JSON, wrong schema version and missing updatedAt", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadProject()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot(), schemaVersion: 2 }));
    expect(loadProject()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot(), updatedAt: 123 }));
    expect(loadProject()).toBeNull();
  });

  it("revalidates restored baseline and draft structure", () => {
    const corrupted = snapshot();
    corrupted.draft = { regions: [{ ...salesDemo.regions[0], current: -1 }] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corrupted));
    expect(loadProject()).toBeNull();
  });

  it("restores a persisted draft edit", () => {
    const edited = structuredClone(salesDemo);
    edited.regions[0].current = 90;
    saveProject({ ...snapshot(), draft: edited });
    expect(loadProject()?.draft.regions[0].current).toBe(90);
    expect(loadProject()?.baseline.regions[0].current).toBe(120);
  });

  it("returns a defensive copy of the restored data", () => {
    saveProject(snapshot());
    const first = loadProject()!;
    first.draft.regions[0].current = 999;
    expect(loadProject()?.draft.regions[0].current).toBe(120);
  });
});
