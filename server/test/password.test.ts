import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.js";

describe("password hashing", () => {
  it("produces a salted hash that verifies correctly", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("uses a unique salt per password", async () => {
    const a = await hashPassword("same-password-1");
    const b = await hashPassword("same-password-1");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-1", b)).toBe(true);
  });

  it("rejects short passwords and malformed hashes safely", async () => {
    await expect(hashPassword("short")).rejects.toThrow("at least 8");
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$abc$deadbeef")).toBe(false);
  });
});
