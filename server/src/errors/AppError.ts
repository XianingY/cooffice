/** Stable error codes returned to API clients. */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

/**
 * Typed application error. Carries an HTTP status, a stable machine code and
 * an optional detail object. Messages are safe to expose; internal causes are
 * logged separately and never serialized to clients.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = "Request is invalid", details?: unknown): AppError {
    return new AppError(400, "VALIDATION_ERROR", message, details);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "You do not have access to this resource"): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(message = "Resource already exists"): AppError {
    return new AppError(409, "CONFLICT", message);
  }

  static internal(message = "An unexpected error occurred"): AppError {
    return new AppError(500, "INTERNAL_ERROR", message);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
