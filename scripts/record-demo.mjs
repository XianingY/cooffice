#!/usr/bin/env node
/**
 * Capture an authentic animated GIF (`docs/demo.gif`) from the built SPA using
 * Playwright Chromium + ffmpeg palette optimization.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outGif = join(root, "docs", "demo.gif");
const framesDir = mkdtempSync(join(tmpdir(), "whatif-demo-frames-"));
const port = 4179;
const baseUrl = `http://127.0.0.1:${port}/`;

async function waitForServer(url) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Preview server did not start at ${url}`);
}

const server = spawn("npx", ["vite", "preview", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], {
  cwd: root,
  stdio: "ignore",
});

try {
  await waitForServer(baseUrl);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 780 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    let frameIndex = 0;
    const snap = async (repeats = 1) => {
      for (let i = 0; i < repeats; i += 1) {
        const path = join(framesDir, `frame-${String(frameIndex).padStart(3, "0")}.png`);
        frameIndex += 1;
        await page.screenshot({ path });
      }
    };

    // Scene 1: Initial workspace (hold)
    await snap(3);

    // Scene 2: Trigger 1-click preset (ranking flip + source highlight)
    await page.getByRole("button", { name: /模拟华东下滑 25%/ }).click();
    await page.waitForTimeout(150);
    await snap(4);

    // Scene 3: Switch to Dark theme
    await page.getByRole("button", { name: "切换主题" }).click();
    await page.getByRole("button", { name: "切换主题" }).click();
    await page.waitForTimeout(150);
    await snap(3);

    // Scene 4: Back to Light theme, apply changes, switch to budget template
    await page.getByRole("button", { name: "切换主题" }).click();
    await page.getByRole("button", { name: "应用修改" }).click();
    await page.selectOption("#scenario-template-select", "budget");
    await page.getByRole("button", { name: "确认导入" }).click();
    await page.waitForTimeout(150);
    await snap(2);

    // Scene 5: Trigger budget preset
    await page.getByRole("button", { name: /模拟市场部追加投放/ }).click();
    await page.waitForTimeout(150);
    await snap(4);
  } finally {
    await browser.close();
  }

  // Encode at 1.25 fps (0.8s per beat, repeated frames hold key scenes) with palette optimization.
  const filter = "fps=1.25,scale=1040:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3";
  execFileSync(
    "ffmpeg",
    ["-y", "-framerate", "1.25", "-i", join(framesDir, "frame-%03d.png"), "-vf", filter, "-loop", "0", outGif],
    { stdio: "inherit" },
  );
  const bytes = statSync(outGif).size;
  process.stdout.write(`✓ Generated ${outGif} (${Math.round(bytes / 1024)} KB)\n`);
} finally {
  server.kill("SIGTERM");
  rmSync(framesDir, { recursive: true, force: true });
}
