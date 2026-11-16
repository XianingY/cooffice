import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createLogger } from "../logging/logger.js";

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

/** Log request completion once with duration and correlation ID. */
export function registerRequestLogging(app: FastifyInstance, level: string, pretty: boolean): void {
  const logger = createLogger(level, pretty);
  app.log = logger as typeof app.log;
  app.addHook("onRequest", requestIdHook);
  app.addHook("onResponse", (request, reply, done) => {
    logger.info(
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
