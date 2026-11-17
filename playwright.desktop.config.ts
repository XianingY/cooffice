import { defineConfig } from "@playwright/test";

/**
 * Desktop E2E: drives the real Electron shell (embedded API included) the same
 * way a user would, against a throwaway profile directory.
 */
export default defineConfig({
  testDir: "./e2e-desktop",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
});
