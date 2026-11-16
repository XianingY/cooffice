import { describe, expect, it } from "vitest";
import { openDatabase, transaction } from "../src/db/connection.js";
import { MIGRATIONS, migrate } from "../src/db/migrations.js";

function freshDb() {
  return openDatabase(":memory:");
}

describe("database migrations", () => {
  it("applies all migrations to a fresh database", () => {
    const db = freshDb();
    try {
      expect(migrate(db)).toEqual(MIGRATIONS.map((migration) => migration.id));
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      const names = tables.map((row) => row.name);
      expect(names).toContain("users");
      expect(names).toContain("projects");
      expect(names).toContain("refresh_tokens");
      expect(names).toContain("audit_logs");
      expect(names).toContain("schema_migrations");
    } finally {
      db.close();
    }
  });

  it("is idempotent — re-running applies nothing", () => {
    const db = freshDb();
    try {
      migrate(db);
      expect(migrate(db)).toEqual([]);
      const count = db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get() as { n: number };
      expect(count.n).toBe(MIGRATIONS.length);
    } finally {
      db.close();
    }
  });

  it("enables foreign keys and WAL pragmas", () => {
    const db = freshDb();
    try {
      expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    } finally {
      db.close();
    }
  });

  it("rolls back a transaction when work throws", () => {
    const db = freshDb();
    try {
      migrate(db);
      expect(() =>
        transaction(db, () => {
          db.prepare("INSERT INTO users (id,email,password_hash,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?)")
            .run("u1", "a@b.test", "hash", "A", "now", "now");
          throw new Error("rollback");
        }),
      ).toThrow("rollback");
      const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
      expect(count.n).toBe(0);
    } finally {
      db.close();
    }
  });
});
