import type { FastifyInstance } from "fastify";
import { makeAuthGuard, currentUserId } from "../auth/authMiddleware.js";
import { parseBody } from "../../middleware/validate.js";
import { docsMeta } from "../../docs/openapi.js";
import type { TokenService } from "../auth/tokens.js";
import { EventBus } from "../../events/eventBus.js";
import { publishProjectEvent } from "../../events/sseRoutes.js";
import {
  createProjectSchema,
  draftBodySchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from "./projectSchemas.js";
import { ProjectService } from "./projectService.js";

export interface ProjectRouteDeps {
  service: ProjectService;
  tokens: TokenService;
  events: EventBus;
}

/** REST endpoints for projects; delegates all rules to ProjectService. */
export async function registerProjectRoutes(app: FastifyInstance, deps: ProjectRouteDeps): Promise<void> {
  const guard = makeAuthGuard(deps.tokens);
  const protectedOpts = { preHandler: guard };

  app.post("/api/projects", { ...protectedOpts, schema: docsMeta.createProject }, async (request, reply) => {
    const body = parseBody(createProjectSchema, request.body);
    const project = deps.service.create(currentUserId(request), body, request.requestId);
    publishProjectEvent(deps.events, "project.updated", project.id, project.ownerId);
    void reply.status(201);
    return project;
  });

  app.get("/api/projects", protectedOpts, async (request) => {
    const query = listProjectsQuerySchema.parse(request.query);
    return deps.service.list(currentUserId(request), query);
  });

  app.get("/api/projects/:id", protectedOpts, async (request) => {
    const { id } = request.params as { id: string };
    return deps.service.get(currentUserId(request), id);
  });

  app.patch("/api/projects/:id", protectedOpts, async (request) => {
    const { id } = request.params as { id: string };
    const body = parseBody(updateProjectSchema, request.body);
    const actorId = currentUserId(request);
    const project = deps.service.update(actorId, id, body, request.requestId);
    publishProjectEvent(deps.events, "project.updated", id, actorId);
    return project;
  });

  app.delete("/api/projects/:id", protectedOpts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actorId = currentUserId(request);
    deps.service.remove(actorId, id, request.requestId);
    publishProjectEvent(deps.events, "project.deleted", id, actorId);
    void reply.status(204);
    return undefined;
  });

  app.put("/api/projects/:id/draft", protectedOpts, async (request) => {
    const { id } = request.params as { id: string };
    const { draft } = parseBody(draftBodySchema, request.body);
    const actorId = currentUserId(request);
    const project = deps.service.editDraft(actorId, id, draft, request.requestId);
    publishProjectEvent(deps.events, "project.updated", id, actorId);
    return project;
  });

  app.post("/api/projects/:id/apply", protectedOpts, async (request) => {
    const { id } = request.params as { id: string };
    const actorId = currentUserId(request);
    const project = deps.service.applyDraft(actorId, id, request.requestId);
    publishProjectEvent(deps.events, "project.updated", id, actorId);
    return project;
  });

  app.post("/api/projects/:id/revert", protectedOpts, async (request) => {
    const { id } = request.params as { id: string };
    const actorId = currentUserId(request);
    const project = deps.service.revertDraft(actorId, id, request.requestId);
    publishProjectEvent(deps.events, "project.updated", id, actorId);
    return project;
  });
}
