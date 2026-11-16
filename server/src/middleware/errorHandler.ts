import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { sendError } from "../errors/errorResponse.js";

/** Central error handler: one place maps all thrown errors to client responses. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    // Normalize uncaught Zod validation (e.g. query-string schemas) to 400.
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
      sendError(reply, request.requestId, AppError.badRequest("Request parameters are invalid", details));
      return;
    }
    const statusCode = error instanceof Error && "statusCode" in error ? (error as { statusCode?: unknown }).statusCode : undefined;
    const isExpected = error instanceof AppError || (typeof statusCode === "number" && statusCode < 500);
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
