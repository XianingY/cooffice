import { describe, expect, it, vi } from "vitest";
import { resolveUpdateFeed, runUpdateCheck, type UpdaterLike } from "../src/main/updater.js";

function updaterWith(version?: string, failure?: Error): UpdaterLike {
  return {
    checkForUpdates: vi.fn(async () => {
      if (failure) throw failure;
      return { updateInfo: { version } };
    }),
  };
}

describe("update checks", () => {
  it("reports unconfigured instead of pretending when no feed exists", async () => {
    const result = await runUpdateCheck(null, "1.2.0");
    expect(result.status).toBe("unconfigured");
    expect(result.message).toContain("更新源");
  });

  it("recognises the current version", async () => {
    await expect(runUpdateCheck(updaterWith("1.2.0"), "1.2.0")).resolves.toMatchObject({
      status: "up-to-date",
      version: "1.2.0",
    });
  });

  it("reports a newer version", async () => {
    await expect(runUpdateCheck(updaterWith("1.3.0"), "1.2.0")).resolves.toMatchObject({
      status: "available",
      version: "1.3.0",
    });
  });

  it("surfaces a failed check without throwing", async () => {
    const result = await runUpdateCheck(updaterWith(undefined, new Error("offline")), "1.2.0");
    expect(result).toEqual({ status: "error", message: "offline" });
  });

  it("only accepts https feeds", () => {
    expect(resolveUpdateFeed({})).toBeNull();
    expect(resolveUpdateFeed({ WHATIF_UPDATE_FEED: "http://example.com" })).toBeNull();
    expect(resolveUpdateFeed({ WHATIF_UPDATE_FEED: "https://updates.example.com/app" })).toBe(
      "https://updates.example.com/app",
    );
  });
});
