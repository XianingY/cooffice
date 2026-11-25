import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { AuditRepository } from "../src/modules/audit/auditRepository.js";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.js";
import { ProfileService } from "../src/modules/auth/profileService.js";
import { RefreshTokenRepository } from "../src/modules/auth/refreshTokenRepository.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";
import { AppError } from "../src/errors/AppError.js";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const users = new UserRepository(db);
  const refreshTokens = new RefreshTokenRepository(db);
  const user = users.create({ email: "p@b.test", passwordHash: "", displayName: "Old" });
  return {
    db,
    users,
    refreshTokens,
    user,
    service: new ProfileService(users, refreshTokens, new AuditRepository(db)),
  };
}

describe("ProfileService", () => {
  it("updates display name with validation", async () => {
    const { db, service, user } = setup();
    try {
      expect(service.update(user.id, "  New Name  ").displayName).toBe("New Name");
      expect(() => service.update(user.id, "   ")).toThrow(AppError);
    } finally { db.close(); }
  });

  it("changes password only with the correct current one", async () => {
    const { db, users, user, service } = setup();
    try {
      users.updatePassword(user.id, await hashPassword("old-password"));
      await expect(service.changePassword(user.id, "wrong", "new-password", "r1")).rejects.toThrow("Current password");
      await service.changePassword(user.id, "old-password", "new-password", "r2");
      expect(await verifyPassword("new-password", users.findById(user.id)!.passwordHash)).toBe(true);
    } finally { db.close(); }
  });

  it("revokes every existing refresh session on password change", async () => {
    const { db, users, refreshTokens, user, service } = setup();
    try {
      users.updatePassword(user.id, await hashPassword("old-password"));
      const familyA = refreshTokens.create(user.id, "hash-a", "family-a", Date.now() + 60_000);
      const familyB = refreshTokens.create(user.id, "hash-b", "family-b", Date.now() + 60_000);

      await service.changePassword(user.id, "old-password", "new-password", "r1");

      expect(refreshTokens.findByHash("hash-a")!.revokedAt).not.toBeNull();
      expect(refreshTokens.findByHash("hash-b")!.revokedAt).not.toBeNull();
      expect(familyA.familyId).not.toBe(familyB.familyId);
    } finally { db.close(); }
  });

  it("rejects reuse and missing users", async () => {
    const { db, users, user, service } = setup();
    try {
      users.updatePassword(user.id, await hashPassword("same-password"));
      await expect(service.changePassword(user.id, "same-password", "same-password", "r1")).rejects.toThrow("differ");
      expect(() => service.update("missing", "X")).toThrow("not found");
    } finally { db.close(); }
  });
});
