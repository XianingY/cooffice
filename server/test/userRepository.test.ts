import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  return { db, repo: new UserRepository(db) };
}

describe("UserRepository", () => {
  it("creates and finds a user by id and case-insensitive email", () => {
    const { db, repo } = setup();
    try {
      const created = repo.create({ email: "Alice@Example.com", passwordHash: "hash", displayName: "Alice" });
      expect(created.email).toBe("alice@example.com");
      expect(repo.findById(created.id)?.displayName).toBe("Alice");
      expect(repo.findByEmail("ALICE@EXAMPLE.COM")?.id).toBe(created.id);
    } finally {
      db.close();
    }
  });

  it("returns null for missing users", () => {
    const { db, repo } = setup();
    try {
      expect(repo.findById("missing")).toBeNull();
      expect(repo.findByEmail("missing@example.com")).toBeNull();
    } finally {
      db.close();
    }
  });

  it("updates password hash and timestamp", () => {
    const { db, repo } = setup();
    try {
      const user = repo.create({ email: "a@b.test", passwordHash: "old", displayName: "A" });
      repo.updatePassword(user.id, "new");
      expect(repo.findById(user.id)?.passwordHash).toBe("new");
    } finally {
      db.close();
    }
  });

  it("rejects duplicate emails via unique constraint", () => {
    const { db, repo } = setup();
    try {
      repo.create({ email: "dup@test.dev", passwordHash: "h", displayName: "D" });
      expect(() => repo.create({ email: "DUP@test.dev", passwordHash: "h", displayName: "D2" })).toThrow();
    } finally {
      db.close();
    }
  });
});
