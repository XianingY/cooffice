import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";
import { ProfileService } from "../src/modules/auth/profileService.js";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.js";
import { AppError } from "../src/errors/AppError.js";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const users = new UserRepository(db);
  const user = users.create({ email: "p@b.test", passwordHash: "", displayName: "Old" });
  return { db, users, user, service: new ProfileService(users) };
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
      await expect(service.changePassword(user.id, "wrong", "new-password")).rejects.toThrow("Current password");
      await service.changePassword(user.id, "old-password", "new-password");
      expect(await verifyPassword("new-password", users.findById(user.id)!.passwordHash)).toBe(true);
    } finally { db.close(); }
  });

  it("rejects reuse and missing users", async () => {
    const { db, users, user, service } = setup();
    try {
      users.updatePassword(user.id, await hashPassword("same-password"));
      await expect(service.changePassword(user.id, "same-password", "same-password")).rejects.toThrow("differ");
      expect(() => service.update("missing", "X")).toThrow("not found");
    } finally { db.close(); }
  });
});
