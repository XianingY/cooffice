import type { FastifyInstance } from "fastify";
import { EventBus } from "./eventBus.js";
import { currentUserId, makeAuthGuard } from "../modules/auth/authMiddleware.js";
import type { TokenService } from "../modules/auth/tokens.js";
import type { ProjectService } from "../modules/projects/projectService.js";

export interface SseRouteOptions {
  bus: EventBus;
  tokens: TokenService;
  /** Ownership checks must use the same service as the project routes. */
  projects: ProjectService;
  /**
   * Origins allowed to read the stream. `reply.hijack()` bypasses Fastify's
   * CORS hook, so the response headers are written here instead.
   */
  allowedOrigins: string[];
}

/**
 * CORS headers for the hijacked stream. Only echoes an origin the deployment
 * already allows; anything else gets no header and the browser blocks it.
 */
export function sseCorsHeaders(
  origin: string | undefined,
  allowedOrigins: string[],
): Record<string, string> {
  if (origin === undefined || !allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

/** SSE endpoint streams project-scoped events with heartbeats and cleanup. */
export async function registerSseRoutes(
  app: FastifyInstance,
  options: SseRouteOptions,
): Promise<void> {
  const { bus, tokens, projects, allowedOrigins } = options;
  const guard = makeAuthGuard(tokens);

  app.get("/api/projects/:id/events", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Verify ownership before hijacking: an authenticated user must not be
    // able to stream another user's project changes. Service.get() throws 404
    // for unknown ids and 403 for foreign projects.
    projects.get(currentUserId(request), id);
    reply.hijack();
    const raw = reply.raw;

    raw.writeHead(200, {
      ...sseCorsHeaders(request.headers.origin, allowedOrigins),
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    raw.write(`event: connected\ndata: ${JSON.stringify({ projectId: id })}\n\n`);

    const send = (event: unknown) => {
      if (!raw.writableEnded) raw.write(`event: project-change\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = bus.subscribe(id, send);

    const heartbeat = setInterval(() => {
      if (!raw.writableEnded) raw.write(": heartbeat\n\n");
    }, 15_000);
    heartbeat.unref?.();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.raw.on("close", cleanup);
    raw.on("close", cleanup);
  });
}

/** Publish a project event after successful mutations. */
export function publishProjectEvent(
  bus: EventBus,
  type: "project.updated" | "project.deleted",
  projectId: string,
  actorId: string,
): void {
  bus.publish({ type, projectId, actorId, at: new Date().toISOString() });
}
