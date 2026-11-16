import type { FastifyReply } from "fastify";
import { AppError, type ErrorCode } from "./AppError.js";

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

const STATUS_CODE_MAP: Record<number, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  413: "PAYLOAD_TOO_LARGE",
};

/** Serialize errors into one normalized shape; never leak stack traces. */
export function sendError(reply: FastifyReply, requestId: string, error: unknown): void {
  if (error instanceof AppError) {
    const body: ErrorResponse = {
      error: { code: error.code, message: error.message, requestId },
    };
    if (error.details !== undefined) body.error.details = error.details;
    void reply.status(error.statusCode).send(body);
    return;
  }

  const status = typeof (error as { statusCode?: unknown })?.statusCode === "number"
    ? (error as { statusCode: number }).statusCode
    : 500;
  const code = STATUS_CODE_MAP[status] ?? "INTERNAL_ERROR";
  const message = code === "INTERNAL_ERROR" ? "An unexpected error occurred" : (error as Error).message;
  void reply.status(status).send({ error: { code, message, requestId } } satisfies ErrorResponse);
}
