import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { AuditRepository } from "../src/modules/audit/auditRepository.js";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  return { db, repo: new AuditRepository(db) };
}

describe("AuditRepository", () => {
  it("appends entries with metadata and lists newest first", () => {
    const { db, repo } = setup();
    try {
      repo.append({ requestId: "r1", actorId: "u1", action: "login", entity: "auth" });
      repo.append({ requestId: "r2", actorId: "u1", action: "update", entity: "project", entityId: "p1", metadata: { version: 2 } });
      const all = repo.list("project");
      expect(all).toHaveLength(1);
      expect(all[0].entityId).toBe("p1");
      expect(all[0].metadata).toEqual({ version: 2 });
      expect(repo.list("project", "p1")).toHaveLength(1);
      expect(repo.list("project", "other")).toHaveLength(0);
    } finally { db.close(); }
  });

  it("stores null actor for anonymous actions", () => {
    const { db, repo } = setup();
    try {
      repo.append({ requestId: "r3", actorId: null, action: "register", entity: "auth" });
      expect(repo.list("auth")[0].actorId).toBeNull();
    } finally { db.close(); }
  });
});
