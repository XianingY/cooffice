import { describe, expect, it } from "vitest";
import { AppError, isAppError } from "../src/errors/AppError.js";

describe("AppError", () => {
  it("creates typed errors with correct status and code", () => {
    expect(AppError.badRequest()).toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
    expect(AppError.unauthorized()).toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    expect(AppError.forbidden()).toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(AppError.notFound()).toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    expect(AppError.conflict()).toMatchObject({ statusCode: 409, code: "CONFLICT" });
    expect(AppError.internal()).toMatchObject({ statusCode: 500, code: "INTERNAL_ERROR" });
  });

  it("identifies AppError instances", () => {
    expect(isAppError(AppError.badRequest())).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it("keeps details for validation feedback", () => {
    const error = AppError.badRequest("Invalid fields", [{ field: "email" }]);
    expect(error.details).toEqual([{ field: "email" }]);
  });
});
