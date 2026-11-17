import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createShellLogger } from "../src/main/logger.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "whatif-log-"));
  file = join(dir, "nested", "main.log");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("shell logger", () => {
  it("creates the directory and writes one JSON object per line", () => {
    const logger = createShellLogger(file);
    logger.info("started", { version: "1.2.0" });
    logger.error("boom");

    const lines = readFileSync(file, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ level: "info", message: "started", version: "1.2.0" });
    expect(JSON.parse(lines[1])).toMatchObject({ level: "error", message: "boom" });
    expect(JSON.parse(lines[0]).time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rotates once the file grows past the limit", () => {
    const logger = createShellLogger(file, 200);
    for (let index = 0; index < 12; index += 1) logger.info(`line ${index}`);

    expect(existsSync(`${file}.1`)).toBe(true);
    const current = readFileSync(file, "utf8");
    expect(current.length).toBeLessThan(400);
  });

  it("never throws when the path is not writable", () => {
    const logger = createShellLogger(join("/dev/null", "nope", "main.log"));
    expect(() => logger.warn("ignored")).not.toThrow();
  });
});
