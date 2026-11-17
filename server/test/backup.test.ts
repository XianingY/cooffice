import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Db } from "../src/db/connection.js";
import { migrate, pendingMigrations } from "../src/db/migrations.js";
import { backupDatabase } from "../src/db/backup.js";

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "whatif-backup-"));
  db = openDatabase(join(dir, "whatif.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("database snapshots", () => {
  it("reports every migration as pending on an empty database", () => {
    expect(pendingMigrations(db).length).toBeGreaterThan(0);
    migrate(db);
    expect(pendingMigrations(db)).toEqual([]);
  });

  it("writes a snapshot that can be opened and read", async () => {
    migrate(db);
    db.prepare(
      "INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    ).run("u1", "snap@test.dev", "hash", "Snap", "user", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z");

    const result = await backupDatabase(db, join(dir, "backups"));
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);

    const restored = openDatabase(result.filePath);
    try {
      const row = restored.prepare("SELECT email FROM users WHERE id = ?").get("u1") as { email: string };
      expect(row.email).toBe("snap@test.dev");
    } finally {
      restored.close();
    }
  });

  it("keeps only the configured number of snapshots", async () => {
    migrate(db);
    const backups = join(dir, "backups");
    const times = [
      new Date("2026-01-01T10:00:00Z"),
      new Date("2026-01-02T10:00:00Z"),
      new Date("2026-01-03T10:00:00Z"),
    ];
    for (const now of times) {
      await backupDatabase(db, backups, { keep: 2, now });
    }

    const files = readdirSync(backups).sort();
    expect(files).toHaveLength(2);
    // The oldest snapshot is the one dropped.
    expect(files[0]).toContain("20260102");
  });

  it("creates the backup directory when it does not exist yet", async () => {
    migrate(db);
    const nested = join(dir, "profile", "backups");
    const result = await backupDatabase(db, nested);
    expect(existsSync(nested)).toBe(true);
    expect(result.filePath.startsWith(nested)).toBe(true);
  });
});
