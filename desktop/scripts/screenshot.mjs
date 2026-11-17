/**
 * Capture a screenshot of the real desktop window for the documentation.
 * Usage: node scripts/screenshot.mjs [outputPath]
 */
import { _electron as electron } from "playwright-core";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2] ?? resolve(desktopDir, "..", "docs", "desktop.png");
const packageDir = join(desktopDir, "node_modules", "electron");
const executablePath = join(packageDir, "dist", readFileSync(join(packageDir, "path.txt"), "utf8").trim());

const userDataDir = mkdtempSync(join(tmpdir(), "whatif-shot-"));
const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;

const app = await electron.launch({
  executablePath,
  args: [desktopDir, "--no-sandbox"],
  env: { ...env, WHATIF_USER_DATA_DIR: userDataDir },
});
try {
  const page = await app.firstWindow();
  await page.waitForLoadState("networkidle");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: output, fullPage: true });
  console.log(`✓ ${output}`);
} finally {
  await app.close();
  rmSync(userDataDir, { recursive: true, force: true });
}
