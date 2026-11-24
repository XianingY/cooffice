import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The repository is ESM ("type": "module"), so __dirname does not exist here.
const desktopDir = fileURLToPath(new URL("../desktop", import.meta.url));

/** Electron lives in the desktop package, not at the repository root. */
function electronExecutable(): string {
  const packageDir = join(desktopDir, "node_modules", "electron");
  // path.txt holds the platform binary location relative to dist/.
  const relative = readFileSync(join(packageDir, "path.txt"), "utf8").trim();
  return join(packageDir, "dist", relative);
}

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), "whatif-desktop-e2e-"));
  // Some CI shells run with ELECTRON_RUN_AS_NODE=1, which turns the binary into
  // a plain Node and makes Chromium switches look like bad CLI options.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...baseEnv } = process.env;
  app = await electron.launch({
    executablePath: electronExecutable(),
    // Chromium's sandbox needs namespace privileges that restricted runners and
    // containers deny; opt out only when the runner asks for it.
    args: process.env.WHATIF_E2E_NO_SANDBOX === "1" ? [desktopDir, "--no-sandbox"] : [desktopDir],
    env: {
      ...baseEnv,
      NODE_ENV: "production",
      WHATIF_USER_DATA_DIR: userDataDir,
    },
  });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app?.close().catch(() => undefined);
  rmSync(userDataDir, { recursive: true, force: true });
});

test("opens a native window running the full local-first workspace", async () => {
  await expect(page.locator("h1")).toHaveText("What-if Report · 数据沙盘");
  await expect(page.getByLabel("华东当前销售额")).toBeVisible();
  await expect(page.getByRole("button", { name: "应用修改" })).toBeDisabled();
  // The shell marks the document so the stylesheet can reserve the drag strip.
  await expect(page.locator("html")).toHaveAttribute("data-desktop", "true");
});

test("exposes the desktop bridge instead of browser downloads", async () => {
  const info = await page.evaluate(() => (window.desktop ? window.desktop.appInfo() : null));
  expect(info?.isPackaged).toBe(false);
  expect(info?.platform).toBe(process.platform);
  expect(info?.dataDir.startsWith(userDataDir)).toBe(true);
});

test("switches the native theme and persists the choice", async () => {
  const state = await page.evaluate(async () => {
    await window.desktop!.setTheme("dark");
    return window.desktop!.getTheme();
  });
  expect(state).toEqual({ setting: "dark", resolved: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(17, 24, 39)");
  expect(JSON.parse(readFileSync(join(userDataDir, "state", "theme.json"), "utf8"))).toBe("dark");

  // Leave later assertions on a deterministic light palette.
  await page.evaluate(async () => {
    await window.desktop!.setTheme("light");
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("serves cloud features from the embedded server on the app origin", async () => {
  // cloudEnabled is derived from the runtime origin, so the account panel is
  // live without any build-time configuration.
  await expect(page.getByRole("heading", { name: "云端同步(可选)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  const origin = await page.evaluate(() => window.location.origin);
  expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
});

test("registers an account through the guarded embedded API", async () => {
  // Proves the renderer received the per-launch session token: without it the
  // API answers 401 before authentication is even considered.
  await page.getByRole("button", { name: "没有账号?去注册" }).click();
  await page.getByLabel("显示名称").fill("桌面测试");
  await page.getByLabel("邮箱").fill("desktop-e2e@test.dev");
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: "注册" }).click();

  await expect(page.getByText("已登录为 desktop-e2e@test.dev")).toBeVisible();
});

test("edits and applies a draft through the real renderer", async () => {
  const east = page.getByLabel("华东当前销售额");
  await east.fill("90");
  await expect(page.getByText("导出已确认版本，不包含未应用草稿")).toBeVisible();
  // The draft is compared against the confirmed baseline before it is applied.
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();

  await page.getByRole("button", { name: "应用修改" }).click();
  await expect(page.getByRole("button", { name: "应用修改" })).toBeDisabled();
  await expect(east).toHaveValue("90");
});

test("marks the window as edited while a draft is pending", async () => {
  await page.getByLabel("华东当前销售额").fill("95");
  const edited = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isDocumentEdited());
  // macOS shows the dot; other platforms report false and the IPC is a no-op.
  if (process.platform === "darwin") expect(edited).toBe(true);

  await page.getByRole("button", { name: "撤销草稿" }).click();
  const cleared = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isDocumentEdited());
  expect(cleared).toBe(false);
});

test("forwards native menu commands to the renderer", async () => {
  // Same channel the File ▸ 清除本地项目 item uses.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.send("desktop:menu-action", { action: "clear-project" });
  });
  await expect(page.getByRole("button", { name: "确认清除" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("button", { name: "确认清除" })).toHaveCount(0);
});

test("writes exports through the IPC filesystem path", async () => {
  const target = join(userDataDir, "export-check.json");
  const saved = await page.evaluate(async (filePath) => {
    const bridge = window.desktop!;
    const result = await bridge.saveFile({
      suggestedName: "export-check.json",
      data: new TextEncoder().encode('{"ok":true}'),
      filterName: "What-if 项目",
      extensions: ["json"],
      targetPath: filePath,
    });
    return result;
  }, target);
  expect(saved.canceled).toBe(false);
  expect(saved.filePath).toBe(target);
  expect(readFileSync(target, "utf8")).toBe('{"ok":true}');
});

test("keeps data across a window reload", async () => {
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByLabel("华东当前销售额")).toHaveValue("90");
});

test("imports a project dropped onto the window", async () => {
  const stored = await page.evaluate(() => localStorage.getItem("what-if-report:project:v1"));
  expect(stored).not.toBeNull();
  const document = JSON.parse(stored!) as {
    baseline: { regions: { current: number }[] };
    draft: { regions: { current: number }[] };
  };
  document.baseline.regions[0].current = 77;
  document.draft.regions[0].current = 77;
  const target = join(userDataDir, "dropped-project.json");
  writeFileSync(target, JSON.stringify(document));

  await page.evaluate((filePath) => {
    const file = new File(["project"], "dropped-project.json", { type: "application/json" });
    Object.defineProperty(file, "path", { value: filePath });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true, cancelable: true }));
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, target);

  await expect(page.getByLabel("华东当前销售额")).toHaveValue("77");
});

test("rejects an unsupported dropped file without changing the document", async () => {
  const target = join(userDataDir, "notes.txt");
  writeFileSync(target, "not a spreadsheet");
  await page.evaluate((filePath) => {
    const file = new File(["notes"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(file, "path", { value: filePath });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    window.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, target);

  await expect(page.getByText("只支持 .json 项目文件或 .xlsx/.xls/.csv 表格")).toBeVisible();
  await expect(page.getByLabel("华东当前销售额")).toHaveValue("77");
});

test("persists the desktop profile on disk", async () => {
  const dataDir = join(userDataDir, "data");
  expect(existsSync(join(dataDir, "whatif.db"))).toBe(true);
  expect(existsSync(join(dataDir, "jwt-secret.key"))).toBe(true);
  expect(existsSync(join(userDataDir, "logs", "main.log"))).toBe(true);
});

test("persists window bounds and restores them on the next launch", async () => {
  const bounds = { x: 90, y: 90, width: 1100, height: 760 };
  await app.evaluate(({ BrowserWindow }, value) => {
    BrowserWindow.getAllWindows()[0].setBounds(value);
  }, bounds);
  // The main process debounces writes by 400 ms.
  await page.waitForTimeout(800);

  const stateFile = join(userDataDir, "state", "window-state.json");
  expect(JSON.parse(readFileSync(stateFile, "utf8"))).toMatchObject({
    width: bounds.width,
    height: bounds.height,
  });

  await app.close();

  const { ELECTRON_RUN_AS_NODE: _ignored, ...baseEnv } = process.env;
  const relaunched = await electron.launch({
    executablePath: electronExecutable(),
    args: process.env.WHATIF_E2E_NO_SANDBOX === "1" ? [desktopDir, "--no-sandbox"] : [desktopDir],
    env: { ...baseEnv, NODE_ENV: "production", WHATIF_USER_DATA_DIR: userDataDir },
  });
  try {
    await relaunched.firstWindow();
    const restored = await relaunched.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBounds(),
    );
    expect(restored).toMatchObject({ width: bounds.width, height: bounds.height });
  } finally {
    await relaunched.close();
  }
});
