import type { FastifyInstance } from "fastify";
import { makeAuthGuard, currentUserId } from "../auth/authMiddleware.js";
import type { TokenService } from "../auth/tokens.js";
import { parseBody } from "../../middleware/validate.js";
import { ProjectService } from "./projectService.js";
import { parseProjectDocument, toProjectDocument } from "./projectFile.js";
import { z } from "zod";

const importBodySchema = z.object({ document: z.unknown() }).strict();

/** Export/import portable project documents through authenticated HTTP. */
export async function registerProjectFileRoutes(
  app: FastifyInstance,
  options: { service: ProjectService; tokens: TokenService },
): Promise<void> {
  const guard = makeAuthGuard(options.tokens);

  app.get("/api/projects/:id/file", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = options.service.get(currentUserId(request), id);
    void reply.header("Content-Disposition", `attachment; filename="what-if-report-project.json"`);
    return toProjectDocument(project);
  });

  app.post("/api/projects/import", { preHandler: guard }, async (request) => {
    const { document } = parseBody(importBodySchema, request.body);
    const valid = parseProjectDocument(document);
    const project = options.service.create(
      currentUserId(request),
      {
        name: valid.name,
        baseline: valid.baseline,
        draft: valid.draft,
        config: valid.config,
      },
      request.requestId,
    );
    return { id: project.id, name: project.name };
  });
}
