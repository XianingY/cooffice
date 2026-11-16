import type { FastifyInstance } from "fastify";
import { AppError } from "../errors/AppError.js";
import { sendError } from "../errors/errorResponse.js";

/** Central error handler: one place maps all thrown errors to client responses. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const isExpected = error instanceof AppError || (typeof error.statusCode === "number" && error.statusCode < 500);
    if (isExpected) {
      request.log.warn({ err: error, requestId: request.requestId }, "request rejected");
    } else {
      request.log.error({ err: error, requestId: request.requestId }, "unexpected error");
    }
    sendError(reply, request.requestId, error);
  });

  app.setNotFoundHandler((request, reply) => {
    sendError(reply, request.requestId, AppError.notFound(`Route ${request.method} ${request.url} not found`));
  });
}
