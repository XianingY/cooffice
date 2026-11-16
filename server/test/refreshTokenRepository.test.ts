import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import {
  RefreshTokenRepository,
  generateRefreshToken,
  hashToken,
} from "../src/modules/auth/refreshTokenRepository.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const user = new UserRepository(db).create({ email: "a@b.test", passwordHash: "h", displayName: "A" });
  return { db, repo: new RefreshTokenRepository(db), userId: user.id };
}

describe("refresh tokens", () => {
  it("hashes raw tokens and generates unpredictable values", () => {
    const token = generateRefreshToken();
    expect(token.length).toBeGreaterThan(40);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });

  it("stores, finds, revokes and rotates a token family", () => {
    const { db, repo, userId } = setup();
    try {
      const raw = generateRefreshToken();
      const record = repo.create(userId, hashToken(raw), "family-1", Date.now() + 60_000);
      expect(repo.findByHash(hashToken(raw))?.id).toBe(record.id);
      expect(repo.findByHash(raw)).toBeNull();

      const nextRaw = generateRefreshToken();
      const next = repo.create(userId, hashToken(nextRaw), "family-1", Date.now() + 60_000);
      repo.revokeFamily("family-1");
      expect(repo.findByHash(hashToken(raw))?.revokedAt).not.toBeNull();
      expect(repo.findByHash(hashToken(nextRaw))?.revokedAt).not.toBeNull();
      expect(next.id).not.toBe(record.id);
    } finally { db.close(); }
  });

  it("deletes only expired tokens", () => {
    const { db, repo, userId } = setup();
    try {
      repo.create(userId, hashToken("expired"), "f", Date.now() - 1000);
      repo.create(userId, hashToken("valid"), "f", Date.now() + 60_000);
      expect(repo.deleteExpired()).toBe(1);
      expect(repo.findByHash(hashToken("valid"))).not.toBeNull();
    } finally { db.close(); }
  });
});
