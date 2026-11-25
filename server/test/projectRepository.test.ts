import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { ProjectRepository } from "../src/modules/projects/projectRepository.js";
import { createProjectSchema, updateProjectSchema } from "../src/modules/projects/projectSchemas.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";

const salesData = { regions: [{ id: "region-1", name: "华东", previous: 100, current: 120, previousCell: "B2", currentCell: "C2" }] };
const config = { blocks: ["summary" as const, "growthNarrative" as const, "leaderNarrative" as const] };

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const users = new UserRepository(db);
  const owner = users.create({ email: "owner@test.dev", passwordHash: "h", displayName: "Owner" });
  return { db, repo: new ProjectRepository(db), ownerId: owner.id };
}

describe("ProjectRepository", () => {
  it("creates, finds, updates with version check and deletes", () => {
    const { db, repo, ownerId } = setup();
    try {
      const project = repo.create({ ownerId, name: "Q1", baseline: salesData, draft: salesData, config });
      expect(project.version).toBe(1);
      expect(repo.findById(project.id)?.name).toBe("Q1");

      expect(repo.update(project.id, { name: "Q2" }, 999)).toBeNull();
      const updated = repo.update(project.id, { name: "Q2" }, 1);
      expect(updated?.version).toBe(2);
      expect(updated?.name).toBe("Q2");

      expect(repo.delete(project.id)).toBe(true);
      expect(repo.findById(project.id)).toBeNull();
    } finally { db.close(); }
  });

  it("refuses to write when the stored version moved after the read", () => {
    const { db, repo, ownerId } = setup();
    try {
      const project = repo.create({ ownerId, name: "Q1", baseline: salesData, draft: salesData, config });

      // Simulate another process bumping the row between our read and write.
      db.prepare("UPDATE projects SET version = 2, name = 'other' WHERE id = ?").run(project.id);
      const realFind = repo.findById.bind(repo);
      let firstRead = true;
      repo.findById = ((id: string) => {
        const row = realFind(id);
        // Only the initial read is stale; the post-update read must be real.
        if (firstRead && row) {
          firstRead = false;
          return { ...row, version: 1 };
        }
        return row;
      }) as typeof repo.findById;

      expect(repo.update(project.id, { name: "late" })).toBeNull();
      expect(realFind(project.id)!.name).toBe("other");
    } finally { db.close(); }
  });

  it("lists with pagination and sorting, scoped to owner", () => {
    const { db, repo, ownerId } = setup();
    try {
      repo.create({ ownerId, name: "Alpha", baseline: salesData, draft: salesData, config });
      repo.create({ ownerId, name: "Beta", baseline: salesData, draft: salesData, config });
      expect(repo.countByOwner(ownerId)).toBe(2);
      expect(repo.listByOwner(ownerId, { sort: "name", order: "asc", limit: 1 })[0].name).toBe("Alpha");
      expect(repo.listByOwner(ownerId, { offset: 1, sort: "name", order: "asc" })[0].name).toBe("Beta");
      expect(repo.listByOwner("other-owner")).toEqual([]);
    } finally { db.close(); }
  });
});

describe("project schemas", () => {
  it("accepts valid create input and rejects unknown fields", () => {
    expect(createProjectSchema.safeParse({ name: "P", baseline: salesData }).success).toBe(true);
    expect(createProjectSchema.safeParse({ name: "P", baseline: salesData, malicious: true }).success).toBe(false);
  });

  it("rejects invalid sales data and empty patches", () => {
    expect(createProjectSchema.safeParse({ name: "P", baseline: { regions: [] } }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "P", baseline: { regions: [{ ...salesData.regions[0], current: -1 }] } }).success).toBe(false);
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });
});
