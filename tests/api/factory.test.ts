import { describe, expect, it } from "vitest";
import { resolveApiConfig } from "../../src/api/factory";

describe("resolveApiConfig", () => {
  it("disables cloud mode when neither env nor runtime origin is provided", () => {
    expect(resolveApiConfig(undefined, "")).toEqual({ cloudEnabled: false, baseUrl: "" });
    expect(resolveApiConfig("   ", "")).toEqual({ cloudEnabled: false, baseUrl: "" });
  });

  it("enables same-origin proxy deployments without duplicating /api", () => {
    expect(resolveApiConfig("/", "")).toEqual({ cloudEnabled: true, baseUrl: "" });
    expect(resolveApiConfig("/api", "")).toEqual({ cloudEnabled: true, baseUrl: "" });
    expect(resolveApiConfig("/api/", "")).toEqual({ cloudEnabled: true, baseUrl: "" });
  });

  it("normalises explicit backend origins including trailing slashes or /api suffix", () => {
    expect(resolveApiConfig("http://127.0.0.1:3001", "")).toEqual({
      cloudEnabled: true,
      baseUrl: "http://127.0.0.1:3001",
    });
    expect(resolveApiConfig("http://127.0.0.1:3001/", "")).toEqual({
      cloudEnabled: true,
      baseUrl: "http://127.0.0.1:3001",
    });
    expect(resolveApiConfig("http://127.0.0.1:3001/api/", "")).toEqual({
      cloudEnabled: true,
      baseUrl: "http://127.0.0.1:3001",
    });
  });

  it("prefers the desktop runtime origin over build-time env", () => {
    expect(resolveApiConfig("", "http://127.0.0.1:45123/")).toEqual({
      cloudEnabled: true,
      baseUrl: "http://127.0.0.1:45123",
    });
  });
});
