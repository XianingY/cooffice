import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Api, Project } from "../../src/api/endpoints";
import { DEFAULT_REPORT_CONFIG } from "../../src/core/reportConfig";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { useCloudProject } from "../../src/hooks/useCloudProject";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    ownerId: "user-1",
    name: "Q1",
    baseline: salesDemo,
    draft: salesDemo,
    config: DEFAULT_REPORT_CONFIG,
    version: 1,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("useCloudProject", () => {
  it("preserves baseline/draft separation and sends expectedVersion on update", async () => {
    const draft = structuredClone(salesDemo);
    draft.regions[0].current = 90;

    const create = vi.fn(async () => makeProject({ id: "proj-1", version: 1 }));
    const update = vi.fn(async () => makeProject({ id: "proj-1", draft, version: 2 }));
    const saveDraft = vi.fn();
    const apply = vi.fn();
    const api = { projects: { create, update, saveDraft, apply, get: vi.fn() } } as unknown as Api;

    const { result } = renderHook(() => useCloudProject(api));

    await act(async () => {
      await result.current.save("Q1", salesDemo, salesDemo, DEFAULT_REPORT_CONFIG);
    });
    expect(create).toHaveBeenCalledOnce();
    expect(result.current.projectId).toBe("proj-1");
    expect(result.current.version).toBe(1);

    await act(async () => {
      await result.current.save("Q1 edited", salesDemo, draft, DEFAULT_REPORT_CONFIG);
    });
    expect(update).toHaveBeenCalledWith("proj-1", {
      name: "Q1 edited",
      baseline: salesDemo,
      draft,
      config: DEFAULT_REPORT_CONFIG,
      expectedVersion: 1,
    });
    // Must not silently promote draft into baseline.
    expect(saveDraft).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(result.current.version).toBe(2);
  });

  it("does not rebind projectId on fetchProject until bindProject is explicitly called", async () => {
    const other = makeProject({ id: "proj-2", version: 4, name: "Other" });
    const api = {
      projects: {
        create: vi.fn(async () => makeProject({ id: "proj-1", version: 1 })),
        update: vi.fn(),
        get: vi.fn(async () => other),
      },
    } as unknown as Api;

    const { result } = renderHook(() => useCloudProject(api));
    await act(async () => {
      await result.current.save("First", salesDemo, salesDemo, DEFAULT_REPORT_CONFIG);
    });
    expect(result.current.projectId).toBe("proj-1");

    // Fetching another project (e.g. before the user confirms replacement) must keep proj-1 bound.
    let fetched: Project | null = null;
    await act(async () => {
      fetched = await result.current.fetchProject("proj-2");
    });
    expect(fetched).toEqual(other);
    expect(result.current.projectId).toBe("proj-1");

    act(() => {
      result.current.bindProject(other);
    });
    expect(result.current.projectId).toBe("proj-2");
    expect(result.current.version).toBe(4);
  });

  it("supports saveAsNew to fork an existing cloud project into a new record", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce(makeProject({ id: "proj-1", version: 1 }))
      .mockResolvedValueOnce(makeProject({ id: "proj-2", version: 1, name: "Copy" }));
    const update = vi.fn();
    const api = { projects: { create, update, get: vi.fn() } } as unknown as Api;

    const { result } = renderHook(() => useCloudProject(api));
    await act(async () => {
      await result.current.save("Original", salesDemo, salesDemo, DEFAULT_REPORT_CONFIG);
    });
    await act(async () => {
      await result.current.save("Copy", salesDemo, salesDemo, DEFAULT_REPORT_CONFIG, { saveAsNew: true });
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
    expect(result.current.projectId).toBe("proj-2");
  });
});
