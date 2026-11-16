import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors/AppError.js";
import { parseBody } from "../../middleware/validate.js";
import type { Env } from "../../config/env.js";
import { docsMeta } from "../../docs/openapi.js";
import { UserRepository } from "./userRepository.js";
import { AuthService } from "./authService.js";
import { makeAuthGuard } from "./authMiddleware.js";
import type { TokenService } from "./tokens.js";

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80),
}).strict();

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

const REFRESH_COOKIE = "refresh_token";

function refreshCookieOptions(env: Env) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict" as const,
    path: "/api/auth",
    maxAge: 7 * 86400,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export interface AuthRouteDeps {
  service: AuthService;
  users: UserRepository;
  tokens: TokenService;
  env: Env;
}

/** Register HTTP endpoints for the auth feature; no business logic here. */
export async function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): Promise<void> {
  const guard = makeAuthGuard(deps.tokens);

  app.post("/api/auth/register", { schema: docsMeta.register }, async (request, reply) => {
    const body = parseBody(registerSchema, request.body);
    const pair = await deps.service.register(body, request.requestId);
    void reply.setCookie(REFRESH_COOKIE, pair.refreshToken, refreshCookieOptions(deps.env));
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn, user: pair.user };
  });

  app.post("/api/auth/login", {
    schema: docsMeta.login,
    config: { rateLimit: { max: 10, timeWindow: "15m" } },
  }, async (request, reply) => {
    const body = parseBody(loginSchema, request.body);
    const pair = await deps.service.login(body, request.requestId);
    void reply.setCookie(REFRESH_COOKIE, pair.refreshToken, refreshCookieOptions(deps.env));
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn, user: pair.user };
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const token = request.cookies?.[REFRESH_COOKIE];
    if (!token) throw AppError.unauthorized("Refresh cookie missing");
    const pair = await deps.service.refresh(token, request.requestId);
    void reply.setCookie(REFRESH_COOKIE, pair.refreshToken, refreshCookieOptions(deps.env));
    return { accessToken: pair.accessToken, expiresIn: pair.expiresIn, user: pair.user };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies?.[REFRESH_COOKIE];
    if (token) deps.service.logout(token, request.requestId);
    void reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: guard, schema: docsMeta.me }, async (request) => {
    const user = deps.users.findById(request.auth!.sub);
    if (!user) throw AppError.unauthorized("Account no longer exists");
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt };
  });
}
