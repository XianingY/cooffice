import { defineConfig } from "@playwright/test";

/** Full-stack E2E: real Vite frontend + real Fastify API with SQLite. */
export default defineConfig({
  testDir: "./e2e-fullstack",
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "bash scripts/start-fullstack-e2e.sh",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
