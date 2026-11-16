import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { AuditRepository } from "../src/modules/audit/auditRepository.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";
import { ProjectRepository } from "../src/modules/projects/projectRepository.js";
import { ProjectService } from "../src/modules/projects/projectService.js";
import { AppError } from "../src/errors/AppError.js";

const data = { regions: [{ id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" }] };

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const user = new UserRepository(db).create({ email: "a@b.test", passwordHash: "h", displayName: "A" });
  const other = new UserRepository(db).create({ email: "b@b.test", passwordHash: "h", displayName: "B" });
  const service = new ProjectService(new ProjectRepository(db), new AuditRepository(db));
  return { db, service, ownerId: user.id, otherId: other.id };
}

describe("ProjectService", () => {
  it("creates a project with default config and draft equal to baseline", () => {
    const { db, service, ownerId } = setup();
    try {
      const project = service.create(ownerId, { name: "P", baseline: data }, "r1");
      expect(project.config.blocks).toEqual(["summary", "growthNarrative", "leaderNarrative"]);
      expect(project.draft).toEqual(project.baseline);
    } finally { db.close(); }
  });

  it("enforces ownership on get", () => {
    const { db, service, ownerId, otherId } = setup();
    try {
      const project = service.create(ownerId, { name: "P", baseline: data }, "r1");
      expect(() => service.get(otherId, project.id)).toThrow(AppError);
      expect(() => service.get(ownerId, "missing")).toThrow("not found");
    } finally { db.close(); }
  });

  it("supports edit, apply and revert of draft with optimistic locking", () => {
    const { db, service, ownerId } = setup();
    try {
      const project = service.create(ownerId, { name: "P", baseline: data }, "r1");
      const edited = structuredClone(data);
      edited.regions[0].current = 90;
      const withDraft = service.editDraft(ownerId, project.id, edited, "r2");
      expect(withDraft.draft.regions[0].current).toBe(90);
      expect(withDraft.baseline.regions[0].current).toBe(120);

      const applied = service.applyDraft(ownerId, project.id, "r3");
      expect(applied.baseline.regions[0].current).toBe(90);
      const reverted = service.revertDraft(ownerId, project.id, "r4");
      expect(reverted.draft).toEqual(reverted.baseline);
    } finally { db.close(); }
  });

  it("filters projects by name with a parameterized search", () => {
    const { db, service, ownerId } = setup();
    try {
      service.create(ownerId, { name: "Quarterly Report", baseline: data }, "r1");
      service.create(ownerId, { name: "Personal Notes", baseline: data }, "r2");
      const result = service.list(ownerId, { search: "quarter" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Quarterly Report");
      expect(result.total).toBe(1);
      expect(service.list(ownerId, { search: "no-match" }).items).toEqual([]);
    } finally { db.close(); }
  });

  it("rejects stale version updates", () => {
    const { db, service, ownerId } = setup();
    try {
      const project = service.create(ownerId, { name: "P", baseline: data }, "r1");
      service.update(ownerId, project.id, { name: "Q" }, "r2");
      expect(() => service.update(ownerId, project.id, { name: "R", expectedVersion: 1 }, "r3")).toThrow("modified by another");
    } finally { db.close(); }
  });
});
