import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody, strictObject } from "../src/middleware/validate.js";
import { AppError } from "../src/errors/AppError.js";

const schema = strictObject({ email: z.string().email(), age: z.number().int().min(0) });

describe("parseBody", () => {
  it("returns parsed data for a valid body", () => {
    expect(parseBody(schema, { email: "a@b.test", age: 20 })).toEqual({ email: "a@b.test", age: 20 });
  });

  it("throws a validation AppError with field details", () => {
    try {
      parseBody(schema, { email: "bad", age: -1, extra: true });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.statusCode).toBe(400);
      expect(appError.details).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "email" }),
        expect.objectContaining({ path: "age" }),
      ]));
    }
  });

  it("rejects unknown fields at the boundary", () => {
    expect(() => parseBody(schema, { email: "a@b.test", age: 1, role: "admin" })).toThrow(AppError);
  });
});
