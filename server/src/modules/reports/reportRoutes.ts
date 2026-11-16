import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { makeAuthGuard, currentUserId } from "../auth/authMiddleware.js";
import type { TokenService } from "../auth/tokens.js";
import { docsMeta } from "../../docs/openapi.js";
import { ReportService } from "./reportService.js";

const reportQuerySchema = z.object({ draft: z.enum(["true", "false"]).optional() }).strict();

export interface ReportRouteDeps {
  service: ReportService;
  tokens: TokenService;
}

/** Report generation endpoints; baseline is the default source of truth. */
export async function registerReportRoutes(app: FastifyInstance, deps: ReportRouteDeps): Promise<void> {
  const guard = makeAuthGuard(deps.tokens);

  app.post("/api/projects/:id/report", { preHandler: guard, schema: docsMeta.report }, async (request) => {
    const { id } = request.params as { id: string };
    const query = reportQuerySchema.parse(request.query);
    return deps.service.generate(currentUserId(request), id, query.draft === "true");
  });

  app.get("/api/projects/:id/analytics", { preHandler: guard }, async (request) => {
    const { id } = request.params as { id: string };
    return deps.service.analytics(currentUserId(request), id);
  });
}
