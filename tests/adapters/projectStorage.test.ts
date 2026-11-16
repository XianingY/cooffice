import { describe, expect, it } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import type { ProjectFileSnapshot, ProjectSnapshot, ReportConfig } from "../../src/core/types";
import {
  clearProject,
  loadProject,
  saveProject,
  STORAGE_KEY,
} from "../../src/adapters/storage/projectStorage";

const v1Snapshot: ProjectSnapshot = {
  schemaVersion: 1,
  baseline: salesDemo,
  draft: salesDemo,
  updatedAt: "2026-11-16T00:00:00.000Z",
};

const customConfig: ReportConfig = { blocks: ["leaderNarrative", "summary"] };

const v3Document = (): ProjectFileSnapshot => ({
  schemaVersion: 3,
  format: "what-if-report-project",
  baseline: salesDemo,
  draft: salesDemo,
  updatedAt: "2026-11-16T00:00:00.000Z",
  config: customConfig,
});

describe("projectStorage", () => {
  it("round-trips a versioned document and clears it", () => {
    saveProject(v3Document());
    expect(loadProject()?.draft).toEqual(salesDemo);
    expect(loadProject()?.config).toEqual(customConfig);
    clearProject();
    expect(loadProject()).toBeNull();
  });

  it("keeps the stable storage key and writes the current schema with config", () => {
    expect(STORAGE_KEY).toBe("what-if-report:project:v1");
    saveProject(v3Document());
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.schemaVersion).toBe(3);
    expect(Object.keys(raw).sort()).toEqual(["baseline", "config", "draft", "format", "schemaVersion", "updatedAt"]);
  });

  it("migrates a legacy v1 snapshot with default config", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1Snapshot));
    const loaded = loadProject()!;
    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.config.blocks).toEqual(["summary", "growthNarrative", "leaderNarrative"]);
    expect(loaded.baseline).toEqual(salesDemo);
  });

  it("returns null when the key is absent", () => {
    expect(loadProject()).toBeNull();
  });

  it("rejects malformed JSON, unknown versions and missing updatedAt", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadProject()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...v1Snapshot, schemaVersion: 99 }));
    expect(loadProject()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...v1Snapshot, updatedAt: 123 }));
    expect(loadProject()).toBeNull();
  });

  it("revalidates restored baseline and draft structure", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...v3Document(),
      draft: { regions: [{ ...salesDemo.regions[0], current: -1 }] },
    }));
    expect(loadProject()).toBeNull();
  });

  it("normalises invalid restored config without losing data", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...v3Document(),
      config: { blocks: ["bogus", "summary", "summary"] },
    }));
    expect(loadProject()?.config.blocks).toEqual(["summary"]);
    expect(loadProject()?.draft).toEqual(salesDemo);
  });

  it("restores a persisted draft edit and returns defensive copies", () => {
    const edited = structuredClone(salesDemo);
    edited.regions[0].current = 90;
    saveProject({ ...v3Document(), draft: edited });
    expect(loadProject()?.draft.regions[0].current).toBe(90);
    expect(loadProject()?.baseline.regions[0].current).toBe(120);

    const first = loadProject()!;
    first.draft.regions[0].current = 999;
    expect(loadProject()?.draft.regions[0].current).toBe(90);
  });
});
