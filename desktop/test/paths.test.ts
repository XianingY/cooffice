import { describe, expect, it } from "vitest";
import { resolveResources } from "../src/main/paths.js";

const base = {
  resourcesPath: "/Applications/What-if Report.app/Contents/Resources",
  desktopDir: "/repo/desktop",
  userDataPath: "/Users/someone/Library/Application Support/What-if Report",
};

describe("resource paths", () => {
  it("reads packaged resources from the app bundle", () => {
    const paths = resolveResources({ ...base, isPackaged: true });
    expect(paths.webDir).toBe("/Applications/What-if Report.app/Contents/Resources/web");
    expect(paths.serverEntry).toBe(
      "/Applications/What-if Report.app/Contents/Resources/server/dist/desktop/embed.js",
    );
  });

  it("reads development resources from the staging directory", () => {
    const paths = resolveResources({ ...base, isPackaged: false });
    expect(paths.webDir).toBe("/repo/desktop/build/web");
    expect(paths.serverEntry).toBe("/repo/desktop/build/server/dist/desktop/embed.js");
  });

  it("keeps user data outside the bundle in both modes", () => {
    for (const isPackaged of [true, false]) {
      const paths = resolveResources({ ...base, isPackaged });
      expect(paths.dataDir).toBe(`${base.userDataPath}/data`);
      expect(paths.logsDir).toBe(`${base.userDataPath}/logs`);
      expect(paths.stateDir).toBe(`${base.userDataPath}/state`);
    }
  });
});
