import { describe, expect, it } from "vitest";
import { createTokenService } from "../src/modules/auth/tokens.js";

const secret = "test-secret-that-is-long-enough-for-hs256-signing";

describe("token service", () => {
  it("signs and verifies an access token with expected claims", async () => {
    const service = createTokenService(secret);
    const token = await service.signAccess({ sub: "u1", email: "a@b.test", role: "user" }, "15m");
    const claims = await service.verifyAccess(token);
    expect(claims.sub).toBe("u1");
    expect(claims.email).toBe("a@b.test");
    expect(claims.role).toBe("user");
    expect(claims.type).toBe("access");
  });

  it("rejects tokens signed with a different secret", async () => {
    const service = createTokenService(secret);
    const other = createTokenService("a-completely-different-secret-value-for-testing");
    const token = await other.signAccess({ sub: "u1", email: "a@b.test", role: "user" }, "15m");
    await expect(service.verifyAccess(token)).rejects.toThrow();
  });

  it("rejects expired tokens", async () => {
    const service = createTokenService(secret);
    const token = await service.signAccess({ sub: "u1", email: "a@b.test", role: "user" }, "-1s");
    await expect(service.verifyAccess(token)).rejects.toThrow();
  });

  it("rejects malformed tokens", async () => {
    await expect(createTokenService(secret).verifyAccess("not-a-jwt")).rejects.toThrow();
  });
});
