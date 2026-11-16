import type { FastifyRequest } from "fastify";
import { z, type ZodType } from "zod";
import { AppError } from "../errors/AppError.js";

export interface Validated<S extends ZodType> {
  body: z.infer<S>;
}

/**
 * Parse untrusted request bodies at the boundary. Reject unknown fields so
 * clients cannot smuggle data into services, and expose field-level details
 * in the normalized error response.
 */
export function parseBody<S extends ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw AppError.badRequest(
      "Request body is invalid",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Fastify preHandler factory validating request.body against a schema. */
export function bodyValidator<S extends ZodType>(schema: S) {
  return async (request: FastifyRequest): Promise<void> => {
    request.body = parseBody(schema, request.body);
  };
}

/** Strict object: rejects unknown keys by default. */
export function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}
