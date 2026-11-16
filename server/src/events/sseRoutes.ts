import type { FastifyInstance } from "fastify";
import { EventBus } from "./eventBus.js";
import { makeAuthGuard } from "../modules/auth/authMiddleware.js";
import type { TokenService } from "../modules/auth/tokens.js";

export interface SseRouteOptions {
  bus: EventBus;
  tokens: TokenService;
}

/** SSE endpoint streams project-scoped events with heartbeats and cleanup. */
export async function registerSseRoutes(
  app: FastifyInstance,
  options: SseRouteOptions,
): Promise<void> {
  const { bus, tokens } = options;
  const guard = makeAuthGuard(tokens);

  app.get("/api/projects/:id/events", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.hijack();
    const raw = reply.raw;

    raw.writeHead(200, {
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
