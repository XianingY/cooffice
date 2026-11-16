import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

/** Assign a correlation ID to every request, honoring an inbound valid one. */
export function requestIdHook(request: FastifyRequest, _reply: FastifyReply, done: () => void): void {
  const inbound = request.headers["x-request-id"];
  const valid = typeof inbound === "string" && /^[\w-]{8,64}$/.test(inbound);
  request.requestId = valid ? inbound : randomUUID();
  done();
}

/** Log request completion with duration; secrets are redacted by the logger. */
export function registerRequestLogging(app: FastifyInstance): void {
  app.addHook("onRequest", requestIdHook);
  app.addHook("onResponse", (request, reply, done) => {
    request.log.info(
      {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
    done();
  });
}
