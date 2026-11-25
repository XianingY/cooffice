import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/ui/setup.ts",
    // jsdom + userEvent suites take seconds once the whole repo runs in
    // parallel; the default 5s timeout produced load-dependent failures.
    testTimeout: 20_000,
    exclude: ["**/node_modules/**", "**/dist/**", "server/dist/**", "e2e/**", "e2e-fullstack/**", "e2e-desktop/**"],
  },
});
