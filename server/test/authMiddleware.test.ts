import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import { AppError } from "../src/errors/AppError.js";
import { currentUserId, makeAuthGuard, requireRole } from "../src/modules/auth/authMiddleware.js";
import { createTokenService } from "../src/modules/auth/tokens.js";

const tokens = createTokenService("test-secret-long-enough-for-hs256-algorithm");

function request(authHeader?: string): FastifyRequest {
  return { headers: authHeader ? { authorization: authHeader } : {} } as FastifyRequest;
}

describe("auth middleware", () => {
  it("accepts a valid bearer token and attaches claims", async () => {
    const token = await tokens.signAccess({ sub: "u1", email: "a@b.test", role: "user" }, "15m");
    const req = request(`Bearer ${token}`);
    await makeAuthGuard(tokens)(req, {} as never);
    expect(currentUserId(req)).toBe("u1");
  });

  it("rejects missing, malformed and invalid tokens", async () => {
    const guard = makeAuthGuard(tokens);
    await expect(guard(request(), {} as never)).rejects.toBeInstanceOf(AppError);
    await expect(guard(request("Basic abc"), {} as never)).rejects.toThrow("Bearer");
    await expect(guard(request("Bearer garbage"), {} as never)).rejects.toThrow("invalid or expired");
  });

  it("enforces roles after authentication", async () => {
    const token = await tokens.signAccess({ sub: "u1", email: "a@b.test", role: "user" }, "15m");
    const req = request(`Bearer ${token}`);
    await makeAuthGuard(tokens)(req, {} as never);
    await expect(requireRole("admin")(req, {} as never)).rejects.toBeInstanceOf(AppError);
    await expect(requireRole("user", "admin")(req, {} as never)).resolves.toBeUndefined();
    await expect(requireRole("user")(request(), {} as never)).rejects.toThrow("Authentication");
  });
});
