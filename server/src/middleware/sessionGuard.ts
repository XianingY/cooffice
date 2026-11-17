import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "../errors/AppError.js";
import { sendError } from "../errors/errorResponse.js";

export const SESSION_HEADER = "x-whatif-session";

/**
 * Header name the desktop renderer must send with every API call. It is not a
 * replacement for authentication: it only proves the request came from *this*
 * app instance rather than from another local process that guessed the port.
 */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Guard the JSON API with a per-launch token.
 *
 * The embedded server binds to loopback, which stops remote access but not
 * other programs running as the same user. Requiring an unguessable header
 * closes that gap without touching the browser deployment (where no token is
 * configured and the hook is not installed at all).
 *
 * Only `/api/*` is guarded: the HTML shell and its assets carry no user data
 * and have to remain loadable by a plain navigation request.
 */
export function registerSessionGuard(app: FastifyInstance, token: string | undefined): void {
  if (!token) return;

  app.addHook("onRequest", (request, reply, done) => {
    const path = request.url.split("?")[0] ?? "";
    const guarded = path === "/api" || path.startsWith("/api/");
    if (!guarded || request.method === "OPTIONS") {
      done();
      return;
    }
    const provided = request.headers[SESSION_HEADER];
    if (typeof provided === "string" && matches(provided, token)) {
      done();
      return;
    }
    request.log.warn({ requestId: request.requestId, url: request.url }, "rejected: desktop session token");
    sendError(reply, request.requestId, AppError.unauthorized("Desktop session token is missing or invalid"));
  });
}
