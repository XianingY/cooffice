import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { makeAuthGuard, currentUserId } from "../auth/authMiddleware.js";
import { requireRole } from "../auth/authMiddleware.js";
import type { TokenService } from "../auth/tokens.js";
import { AuditRepository } from "./auditRepository.js";

const querySchema = z.object({
  entity: z.enum(["auth", "project"]),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

/** Admin-only audit trail read API; helps investigate security events. */
export async function registerAuditRoutes(
  app: FastifyInstance,
  options: { repo: AuditRepository; tokens: TokenService },
): Promise<void> {
  const guard = makeAuthGuard(options.tokens);

  app.get("/api/admin/audit", {
    preHandler: [guard, requireRole("admin")],
  }, async (request) => {
    const query = querySchema.parse(request.query);
    // Record who read the audit trail.
    options.repo.append({
      requestId: request.requestId,
      actorId: currentUserId(request),
      action: "audit.read",
      entity: query.entity,
      metadata: { entityId: query.entityId, limit: query.limit ?? 50 },
    });
    return { items: options.repo.list(query.entity, query.entityId, query.limit ?? 50) };
  });
}
