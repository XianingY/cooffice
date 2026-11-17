import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_PROJECT_BYTES,
  readProjectFile,
  readSpreadsheetFile,
  writeFileBytes,
} from "../src/main/fileAccess.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "whatif-files-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("file access", () => {
  it("reads project documents as bytes and name", () => {
    const file = join(dir, "project.json");
    writeFileSync(file, '{"schemaVersion":3}');
    const payload = readProjectFile(file);
    expect(payload.name).toBe("project.json");
    expect(Buffer.from(payload.bytes).toString("utf8")).toBe('{"schemaVersion":3}');
  });

  it("rejects a non-JSON project file", () => {
    const file = join(dir, "notes.txt");
    writeFileSync(file, "hello");
    expect(() => readProjectFile(file)).toThrow(/不支持的文件类型/);
  });

  it("rejects a project file above the size limit", () => {
    const file = join(dir, "huge.json");
    writeFileSync(file, Buffer.alloc(MAX_PROJECT_BYTES + 1, 123));
    expect(() => readProjectFile(file)).toThrow(/文件过大/);
  });

  it("accepts the spreadsheet formats the importer understands", () => {
    for (const name of ["sales.xlsx", "legacy.xls", "export.csv"]) {
      const file = join(dir, name);
      writeFileSync(file, "data");
      expect(readSpreadsheetFile(file).name).toBe(name);
    }
  });

  it("rejects a spreadsheet with an unknown extension", () => {
    const file = join(dir, "report.pdf");
    writeFileSync(file, "data");
    expect(() => readSpreadsheetFile(file)).toThrow(/不支持的文件类型/);
  });

  it("writes renderer bytes verbatim", () => {
    const target = join(dir, "out.bin");
    writeFileBytes(target, new Uint8Array([1, 2, 3]));
    expect(readFileSync(target)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("reports a missing file instead of crashing", () => {
    expect(() => readProjectFile(join(dir, "nope.json"))).toThrow();
    expect(statSync(dir).isDirectory()).toBe(true);
  });
});
