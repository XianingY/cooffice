import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/ui/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "server/dist/**", "e2e/**", "e2e-fullstack/**"],
  },
});
