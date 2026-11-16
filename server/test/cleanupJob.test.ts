import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrations.js";
import { RefreshTokenRepository } from "../src/modules/auth/refreshTokenRepository.js";
import { RefreshTokenCleanupJob } from "../src/modules/auth/cleanupJob.js";
import { UserRepository } from "../src/modules/auth/userRepository.js";

const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

function setup() {
  const db = openDatabase(":memory:");
  migrate(db);
  const user = new UserRepository(db).create({ email: "c@b.test", passwordHash: "h", displayName: "C" });
  const repo = new RefreshTokenRepository(db);
  repo.create(user.id, "expired-hash", "f1", Date.now() - 1000);
  repo.create(user.id, "valid-hash", "f2", Date.now() + 60_000);
  return { db, repo, job: new RefreshTokenCleanupJob({ repo, logger }) };
}

describe("RefreshTokenCleanupJob", () => {
  it("removes only expired tokens and is idempotent", () => {
    const { db, repo, job } = setup();
    try {
      expect(job.runOnce()).toBe(1);
      expect(job.runOnce()).toBe(0);
      expect(repo.findByHash("expired-hash")).toBeNull();
      expect(repo.findByHash("valid-hash")).not.toBeNull();
    } finally { db.close(); }
  });

  it("starts and stops a timer without leaking it", () => {
    const { db, job } = setup();
    try {
      job.start();
      job.start(); // idempotent
      job.stop();
      job.stop(); // idempotent
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ intervalMs: 3_600_000 }), "refresh-token cleanup started");
    } finally { db.close(); }
  });

  it("logs failures and continues", () => {
    const { db, job } = setup();
    try {
      const failing = new RefreshTokenCleanupJob({
        repo: { deleteExpired: () => { throw new Error("db down"); } } as unknown as RefreshTokenRepository,
        logger,
      });
      expect(failing.runOnce()).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), "refresh-token cleanup failed");
      expect(job.runOnce()).toBe(1);
    } finally { db.close(); }
  });
});
