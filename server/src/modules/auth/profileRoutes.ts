import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { makeAuthGuard, currentUserId } from "./authMiddleware.js";
import type { TokenService } from "./tokens.js";
import { parseBody } from "../../middleware/validate.js";
import { ProfileService } from "./profileService.js";

const displayNameSchema = z.object({ displayName: z.string().min(1).max(80) }).strict();
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
}).strict();

/** Profile endpoints behind authentication. */
export async function registerProfileRoutes(
  app: FastifyInstance,
  options: { service: ProfileService; tokens: TokenService },
): Promise<void> {
  const guard = makeAuthGuard(options.tokens);

  app.patch("/api/me", { preHandler: guard }, async (request) => {
    const { displayName } = parseBody(displayNameSchema, request.body);
    return options.service.update(currentUserId(request), displayName);
  });

  app.post("/api/me/password", { preHandler: guard }, async (request) => {
    const body = parseBody(passwordSchema, request.body);
    await options.service.changePassword(currentUserId(request), body.currentPassword, body.newPassword, request.id);
    return { ok: true };
  });
}
