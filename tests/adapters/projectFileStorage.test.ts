import { describe, expect, it, vi } from "vitest";
import { salesDemo } from "../../src/fixtures/salesDemo";
import { createProjectFile } from "../../src/core/projectFile";
import {
  downloadProjectFile,
  PROJECT_FILE_EXTENSION,
  readProjectFile,
} from "../../src/adapters/storage/projectFileStorage";

describe("projectFileStorage", () => {
  const file = createProjectFile(salesDemo, salesDemo, "2026-11-16T00:00:00.000Z");
  const text = JSON.stringify(file);

  it("uses the confirmed .json extension", () => {
    expect(PROJECT_FILE_EXTENSION).toBe(".json");
  });

  it("reads a valid project file and rejects wrong extensions", async () => {
    const fake = (name: string, content: string) =>
      ({ name, size: content.length, text: async () => content }) as unknown as File;
    await expect(readProjectFile(fake("project.whatif", text))).resolves.toEqual(file);
    await expect(readProjectFile(fake("project.json", text))).resolves.toEqual(file);
    await expect(readProjectFile(fake("project.xlsx", text))).rejects.toThrow("只支持 .whatif 或 .json 文件");
    await expect(readProjectFile(fake("project.json", "not json"))).rejects.toThrow("项目文件");
  });

  it("downloads a versioned JSON blob with a stable filename", () => {
    const links: { download: string }[] = [];
    const originalCreate = document.createElement.bind(document);
    const originalObjectUrl = URL.createObjectURL;
    // jsdom does not implement these Blob URL helpers; restore usable no-ops.
    const originalRevoke = URL.revokeObjectURL ?? (() => {});
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => {};
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      const element = originalCreate(tag);
      if (tag === "a") {
        const anchor = element as HTMLAnchorElement;
        links.push(anchor);
        anchor.click = () => {};
      }
      return element;
    }) as typeof document.createElement);

    try {
      downloadProjectFile(file);
      expect(links[0].download).toBe("what-if-report-project.json");
    } finally {
      vi.restoreAllMocks();
      URL.createObjectURL = originalObjectUrl;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
