import { describe, expect, it } from "vitest";
import { sseCorsHeaders } from "../src/events/sseRoutes.js";

const allowed = ["http://localhost:5173", "https://app.example.com"];

describe("SSE CORS headers", () => {
  it("echoes an allowed origin so the browser can read the stream", () => {
    expect(sseCorsHeaders("https://app.example.com", allowed)).toEqual({
      "Access-Control-Allow-Origin": "https://app.example.com",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    });
  });

  it("returns nothing for an unknown or absent origin", () => {
    expect(sseCorsHeaders("http://evil.test", allowed)).toEqual({});
    expect(sseCorsHeaders(undefined, allowed)).toEqual({});
  });
});
