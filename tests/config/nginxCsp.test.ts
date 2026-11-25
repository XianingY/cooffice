import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPA_CSP } from "../../server/src/static/spa";

const nginx = readFileSync(join(__dirname, "..", "..", "nginx.conf"), "utf8");

describe("deployment CSP parity", () => {
  it("ships the same policy on nginx as on the self-hosted SPA", () => {
    const match = nginx.match(/add_header Content-Security-Policy "([^"]+)"/);
    expect(match, "nginx.conf must define a Content-Security-Policy header").not.toBeNull();
    expect(match![1]).toBe(SPA_CSP);
  });

  it("does not leave the API CSP disabled without a proxy policy", () => {
    const middleware = readFileSync(
      join(__dirname, "..", "..", "server", "src", "middleware", "security.ts"),
      "utf8",
    );
    expect(middleware).toContain("contentSecurityPolicy: false");
    // The comment must point at the nginx policy that actually exists.
    expect(nginx).toContain("Content-Security-Policy");
  });
});
