import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startEmbeddedServer, type EmbeddedServer } from "../src/desktop/embed.js";

let dataDir: string;
let staticDir: string;
const servers: EmbeddedServer[] = [];

function makeStaticDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "whatif-desktop-web-"));
  writeFileSync(join(dir, "index.html"), '<!doctype html><div id="root"></div>');
  return dir;
}

async function boot(port?: number): Promise<EmbeddedServer> {
  const server = await startEmbeddedServer({
    dataDir,
    staticDir,
    logLevel: "silent",
    port,
  });
  servers.push(server);
  return server;
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "whatif-desktop-data-"));
  staticDir = makeStaticDir();
});

afterEach(async () => {
  while (servers.length > 0) await servers.pop()?.close();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(staticDir, { recursive: true, force: true });
});

describe("embedded desktop server", () => {
  it("binds loopback only and serves the SPA from the same origin", async () => {
    const server = await boot();
    expect(server.host).toBe("127.0.0.1");
    expect(server.port).toBeGreaterThan(0);
    expect(server.origin).toBe(`http://127.0.0.1:${server.port}`);

    const health = await fetch(`${server.origin}/health`);
    expect(health.status).toBe(200);

    const page = await fetch(`${server.origin}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(await page.text()).toContain('id="root"');
  });

  it("creates the data directory, database and a 0600 signing secret", async () => {
    const server = await boot();
    expect(existsSync(server.databasePath)).toBe(true);
    expect(server.databasePath.startsWith(dataDir)).toBe(true);

    const secretPath = join(dataDir, "jwt-secret.key");
    expect(existsSync(secretPath)).toBe(true);
    expect(server.secretCreated).toBe(true);
    const secret = readFileSync(secretPath, "utf8").trim();
    expect(secret.length).toBeGreaterThanOrEqual(43);
    // POSIX file modes are meaningless on Windows.
    if (process.platform !== "win32") {
      expect(statSync(secretPath).mode & 0o777).toBe(0o600);
    }
  });

  it("reuses the installation secret across launches", async () => {
    const first = await boot();
    const secret = readFileSync(join(dataDir, "jwt-secret.key"), "utf8").trim();
    await first.close();
    servers.length = 0;

    const second = await boot();
    expect(second.secretCreated).toBe(false);
    expect(readFileSync(join(dataDir, "jwt-secret.key"), "utf8").trim()).toBe(secret);
  });

  it("guards the API with a per-launch token", async () => {
    const server = await boot();
    expect(server.apiToken).toMatch(/^[\w-]{43}$/);

    const blocked = await fetch(`${server.origin}/api/auth/me`);
    expect(blocked.status).toBe(401);
    expect(((await blocked.json()) as { error: { message: string } }).error.message).toContain("Desktop session token");

    const allowed = await fetch(`${server.origin}/api/auth/me`, {
      headers: { "x-whatif-session": server.apiToken },
    });
    expect(((await allowed.json()) as { error: { message: string } }).error.message).not.toContain(
      "Desktop session token",
    );
  });

  it("persists accounts in the desktop database across restarts", async () => {
    const first = await boot();
    const registered = await fetch(`${first.origin}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-whatif-session": first.apiToken },
      body: JSON.stringify({ email: "desk@test.dev", password: "password123", displayName: "Desk" }),
    });
    expect(registered.status).toBe(200);
    await first.close();
    servers.length = 0;

    const second = await boot();
    const login = await fetch(`${second.origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-whatif-session": second.apiToken },
      body: JSON.stringify({ email: "desk@test.dev", password: "password123" }),
    });
    expect(login.status).toBe(200);
    const body = (await login.json()) as { user: { email: string } };
    expect(body.user.email).toBe("desk@test.dev");
  });

  it("picks a different port for a second instance", async () => {
    const first = await boot();
    const second = await boot();
    expect(second.port).not.toBe(first.port);
    expect(second.origin).not.toBe(first.origin);
  });

  it("fills a missing data directory instead of failing", async () => {
    rmSync(dataDir, { recursive: true, force: true });
    const server = await boot();
    expect(existsSync(dataDir)).toBe(true);
    expect(existsSync(server.databasePath)).toBe(true);
  });
});
