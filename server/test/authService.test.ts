import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { AuditRepository } from "../src/modules/audit/auditRepository.js";
import { AuthService } from "../src/modules/auth/authService.js";
import { RefreshTokenRepository } from "../src/modules/auth/refreshTokenRepository.js";
import { createTokenService } from "../src/modules/auth/tokens.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";
import { AppError } from "../src/errors/AppError.js";

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const service = new AuthService({
    users: new UserRepository(db),
    refreshTokens: new RefreshTokenRepository(db),
    audit: new AuditRepository(db),
    tokens: createTokenService("test-secret-long-enough-for-hs256-algorithm"),
    accessTtl: "15m",
    refreshTtlMs: 7 * 86400_000,
  });
  return { db, service, refresh: new RefreshTokenRepository(db) };
}

describe("AuthService", () => {
  it("registers a user and issues a verifiable token pair", async () => {
    const { db, service } = setup();
    try {
      const pair = await service.register({ email: "New@Example.com ", password: "password123", displayName: "New" }, "r1");
      expect(pair.user.email).toBe("new@example.com");
      expect(pair.accessToken.split(".")).toHaveLength(3);
      expect(pair.refreshToken.length).toBeGreaterThan(40);
      expect(pair.expiresIn).toBe(900);
    } finally { db.close(); }
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    const { db, service } = setup();
    try {
      await service.register({ email: "a@b.test", password: "password123", displayName: "A" }, "r1");
      const pair = await service.login({ email: "A@B.TEST", password: "password123" }, "r2");
      expect(pair.user.email).toBe("a@b.test");
      await expect(service.login({ email: "a@b.test", password: "wrong" }, "r3")).rejects.toBeInstanceOf(AppError);
    } finally { db.close(); }
  });

  it("rejects duplicate registration", async () => {
    const { db, service } = setup();
    try {
      await service.register({ email: "dup@b.test", password: "password123", displayName: "A" }, "r1");
      await expect(service.register({ email: "dup@b.test", password: "password123", displayName: "B" }, "r2")).rejects.toThrow("already exists");
    } finally { db.close(); }
  });

  it("revokes every session when a rotated token is replayed", async () => {
    const { db, service } = setup();
    try {
      const first = await service.register({ email: "r@b.test", password: "password123", displayName: "R" }, "r1");
      const second = await service.refresh(first.refreshToken, "r2");
      expect(second.refreshToken).not.toBe(first.refreshToken);

      // Replaying the rotated token is treated as theft: the presented family
      // and any newer family for the account are both revoked.
      await expect(service.refresh(first.refreshToken, "r3")).rejects.toThrow("invalid or expired");
      await expect(service.refresh(second.refreshToken, "r4")).rejects.toThrow("invalid or expired");

      // A fresh login starts a clean session, so the user is not locked out.
      const relogin = await service.login({ email: "r@b.test", password: "password123" }, "r5");
      await expect(service.refresh(relogin.refreshToken, "r6")).resolves.toMatchObject({
        user: { email: "r@b.test" },
      });
    } finally { db.close(); }
  });

  it("logs out by revoking the token family", async () => {
    const { db, service } = setup();
    try {
      const pair = await service.register({ email: "l@b.test", password: "password123", displayName: "L" }, "r1");
      service.logout(pair.refreshToken, "r2");
      await expect(service.refresh(pair.refreshToken, "r3")).rejects.toThrow("invalid or expired");
    } finally { db.close(); }
  });
});
