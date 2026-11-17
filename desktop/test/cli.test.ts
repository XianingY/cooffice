import { describe, expect, it } from "vitest";
import { isReadableProjectPath, takeProjectArgument } from "../src/main/cli.js";

const exists = (path: string) => path.endsWith(".json");

describe("launch arguments", () => {
  it("finds a project file passed on the command line", () => {
    expect(takeProjectArgument(["/app/electron", "/tmp/report.json"], exists)).toBe("/tmp/report.json");
  });

  it("ignores switches, non-JSON files and missing paths", () => {
    expect(takeProjectArgument(["/app/electron", "--no-sandbox"], exists)).toBeNull();
    expect(takeProjectArgument(["/app/electron", "/tmp/data.xlsx"], exists)).toBeNull();
    expect(takeProjectArgument(["/app/electron", "/tmp/missing.json"], () => false)).toBeNull();
  });

  it("does not treat the application path as a document", () => {
    expect(takeProjectArgument(["/Applications/What-if Report.app"], exists)).toBeNull();
  });

  it("validates OS-provided paths", () => {
    expect(isReadableProjectPath("/definitely/not/here.json")).toBe(false);
    expect(isReadableProjectPath("/tmp")).toBe(false);
  });
});
