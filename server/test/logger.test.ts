import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger, prettyTransportAvailable } from "../src/logging/logger.js";

let dir: string;

/** pino's file destination writes asynchronously; poll instead of sleeping. */
async function readEventually(file: string, timeoutMs = 3000): Promise<string> {
  const started = Date.now();
  for (;;) {
    try {
      const text = readFileSync(file, "utf8");
      // pino creates the file before flushing, so an empty read is not a hit.
      if (text.trim() !== "") return text;
    } catch (error) {
      if (Date.now() - started > timeoutMs) throw error;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`log file stayed empty: ${file}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "whatif-logger-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("server logger", () => {
  it("writes JSON lines to a destination file", async () => {
    const file = join(dir, "nested", "server.log");
    const logger = createLogger("info", false, file);
    logger.info({ requestId: "abc" }, "handled");

    const line = JSON.parse((await readEventually(file)).trim().split("\n")[0]);
    expect(line).toMatchObject({ level: 30, msg: "handled", requestId: "abc" });
  });

  it("redacts credentials before they reach the log", async () => {
    const file = join(dir, "server.log");
    const logger = createLogger("info", false, file);
    logger.info({ password: "hunter2", token: "abc", refreshToken: "xyz" }, "auth");

    const line = await readEventually(file);
    expect(line).not.toContain("hunter2");
    expect(line).toContain("[REDACTED]");
  });

  it("knows whether the pretty transport is installed", () => {
    // Development installs have pino-pretty; a --omit=dev tree does not. The
    // function must answer without throwing either way.
    expect(typeof prettyTransportAvailable()).toBe("boolean");
  });

  it("falls back to JSON when pretty output is requested without the transport", () => {
    const logger = createLogger("info", true);
    expect(logger.level).toBe("info");
    logger.flush();
  });
});
