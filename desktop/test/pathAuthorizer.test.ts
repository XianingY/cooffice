import { describe, expect, it } from "vitest";
import { PathAuthorizer } from "../src/main/pathAuthorizer.js";

describe("PathAuthorizer", () => {
  it("rejects arbitrary paths until explicitly authorized", () => {
    const auth = new PathAuthorizer();
    expect(auth.canWrite("/tmp/project.json")).toBe(false);
    expect(auth.canReveal("/tmp/project.json")).toBe(false);

    auth.allowWrite("/tmp/project.json");
    expect(auth.canWrite("/tmp/project.json")).toBe(true);
    expect(auth.canReveal("/tmp/project.json")).toBe(true);
  });

  it("refuses disallowed extensions even if added to writable set", () => {
    const auth = new PathAuthorizer();
    auth.allowWrite("/tmp/.zshrc");
    expect(auth.canWrite("/tmp/.zshrc")).toBe(false);

    auth.allowWrite("/tmp/report.whatif");
    expect(auth.canWrite("/tmp/report.whatif")).toBe(true);
  });

  it("allows revealing files inside app-owned data and logs directories", () => {
    const auth = new PathAuthorizer();
    expect(auth.canReveal("/app/userData/logs/main.log", ["/app/userData/logs"])).toBe(true);
    expect(auth.canReveal("/app/userData/logs-evil/x", ["/app/userData/logs"])).toBe(false);
  });
});
