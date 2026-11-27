import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Packaging metadata is not exercised by unit tests, so assert the settings
 * that make double-click launch work. A real packaged app was additionally
 * checked for CFBundleDocumentTypes in Info.plist.
 */
const config = readFileSync(join(__dirname, "..", "electron-builder.yml"), "utf8");

function section(name: string): string {
  const start = config.indexOf(`\n${name}:`);
  if (start < 0) throw new Error(`missing section ${name}`);
  const rest = config.slice(start);
  const next = rest.slice(1).search(/\n[a-z][a-zA-Z]*:/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

describe("packaging configuration", () => {
  it("registers .whatif as default and keeps .json as alternate project association", () => {
    const associations = section("fileAssociations");
    expect(associations).toContain("ext: whatif");
    expect(associations).toContain("rank: Default");
    expect(associations).toContain("ext: json");
    expect(associations).toContain("rank: Alternate");
    expect(associations).toContain("role: Editor");
  });

  it("uses a per-machine NSIS install so Windows writes the association", () => {
    expect(section("nsis")).toContain("perMachine: true");
  });

  it("keeps the staged runtime outside the asar for native modules", () => {
    const resources = section("extraResources");
    expect(resources).toContain("from: build");
    expect(resources).toContain("to: .");
  });
});
