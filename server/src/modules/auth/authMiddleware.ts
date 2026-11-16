import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../errors/AppError.js";
import type { Role } from "../types.js";
import type { AccessTokenClaims, TokenService } from "./tokens.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessTokenClaims;
  }
}

function extractBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Verify the access token and attach claims; reject with 401 on any failure. */
export function makeAuthGuard(tokens: TokenService) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = extractBearer(request);
    if (!token) throw AppError.unauthorized("Bearer token required");
    try {
      request.auth = await tokens.verifyAccess(token);
    } catch {
      throw AppError.unauthorized("Access token is invalid or expired");
    }
  };
}

/** RBAC guard: require one of the allowed roles. Must run after authGuard. */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.auth) throw AppError.unauthorized("Authentication required");
    if (!roles.includes(request.auth.role)) throw AppError.forbidden("Insufficient privileges");
  };
}

/** Convenience: current user id from verified claims. */
export function currentUserId(request: FastifyRequest): string {
  if (!request.auth) throw AppError.unauthorized("Authentication required");
  return request.auth.sub;
}
