import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";

describe("query plans", () => {
  it("uses an index for owner-scoped project listing", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const plan = db.prepare(
        "EXPLAIN QUERY PLAN SELECT id, name, version, updated_at FROM projects WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
      ).all("u1", 20, 0) as { detail: string }[];
      expect(plan.map((row) => row.detail).join(" ")).toMatch(/idx_projects_owner/);
    } finally { db.close(); }
  });

  it("uses an index for audit entity lookups", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const plan = db.prepare(
        "EXPLAIN QUERY PLAN SELECT * FROM audit_logs WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?",
      ).all("project", "p1", 50) as { detail: string }[];
      expect(plan.map((row) => row.detail).join(" ")).toMatch(/idx_audit_entity/);
    } finally { db.close(); }
  });

  it("keeps migrations idempotent with the new index migration", () => {
    const db = openDatabase(":memory:");
    try {
      expect(migrate(db).at(-1)).toBe(5);
      expect(migrate(db)).toEqual([]);
    } finally { db.close(); }
  });
});
