import { app, BrowserWindow, dialog, Menu, nativeTheme, shell } from "electron";
import { join, resolve } from "node:path";
import type { MenuMessage, UpdateCheckResult } from "../shared/contract.js";
import { IPC } from "../shared/contract.js";
import { createShellLogger, type ShellLogger } from "./logger.js";
import { buildMenuTemplate } from "./menu.js";
import { createMainWindow } from "./window.js";
import { hardenSessionPermissions } from "./security.js";
import { isExternalUrlAllowed, registerIpcHandlers, sendMenuAction } from "./ipc.js";
import { isReadableProjectPath, takeProjectArgument } from "./cli.js";
import { resolveResources, type ResourcePaths } from "./paths.js";
import { RecentFilesStore } from "./recentFiles.js";
import { resolveUpdateFeed, runUpdateCheck } from "./updater.js";

const APP_NAME = "What-if Report";
app.setName(APP_NAME);
if (process.platform === "win32") app.setAppUserModelId("com.whatifreport.desktop");

// Lets automated runs (and portable installs) keep their data separate from the
// real profile. Must happen before anything reads app.getPath("userData").
const userDataOverride = process.env.WHATIF_USER_DATA_DIR;
if (userDataOverride) app.setPath("userData", resolve(userDataOverride));

interface EmbeddedServerHandle {
  origin: string;
  port: number;
  close(): Promise<void>;
}

let mainWindow: BrowserWindow | null = null;
let embedded: EmbeddedServerHandle | null = null;
let logger: ShellLogger | null = null;
let origin = "";
let quitting = false;
let pendingProjectPath: string | null = null;

function log(): ShellLogger {
  if (logger) return logger;
  logger = createShellLogger(join(app.getPath("userData"), "logs", "main.log"));
  return logger;
}

function openExternal(url: string): void {
  if (isExternalUrlAllowed(url)) void shell.openExternal(url);
}

/**
 * Load the embedded API through the same entry the packaging step produced.
 *
 * `require()` (not dynamic `import()`) because this file is compiled to
 * CommonJS, where TypeScript would rewrite `import()` into a `require()` that
 * cannot handle a `file://` URL. Electron's Node (22.19) can require an ESM
 * module directly, and the server entry has no top-level await.
 */
async function startEmbeddedServer(paths: ResourcePaths): Promise<EmbeddedServerHandle> {
  const module = require(paths.serverEntry) as {
    startEmbeddedServer(options: Record<string, unknown>): Promise<EmbeddedServerHandle>;
  };
  return module.startEmbeddedServer({
    dataDir: paths.dataDir,
    staticDir: paths.webDir,
    logFile: join(paths.logsDir, "server.log"),
    logLevel: app.isPackaged ? "info" : "debug",
  });
}

function checkForUpdates(): Promise<UpdateCheckResult> {
  return (async () => {
    const feed = resolveUpdateFeed();
    let updater = null;
    try {
      const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
      if (feed) autoUpdater.setFeedURL({ provider: "generic", url: feed });
      // Without a publish config electron-updater throws on check, which
      // runUpdateCheck turns into a plain "unconfigured" status.
      autoUpdater.autoDownload = false;
      updater = autoUpdater;
    } catch (error) {
      log().warn("updater unavailable", { message: String(error) });
      return runUpdateCheck(null, app.getVersion());
    }
    const result = await runUpdateCheck(updater, app.getVersion());
    log().info("update check", { status: result.status, version: result.version });
    return result;
  })();
}

function shortcutsMessage(): string {
  return [
    "⌘O  打开项目文件",
    "⌘S  保存项目文件",
    "⌘I  导入 Excel 或 CSV",
    "⌘E  导出 Excel",
    "⇧⌘E 导出 Word",
    "",
    "编辑单元格后使用「应用修改」确认；导出始终使用已确认版本。",
  ].join("\n");
}

function refreshMenu(recent: RecentFilesStore): void {
  const template = buildMenuTemplate({
    appName: APP_NAME,
    isMac: process.platform === "darwin",
    isDev: !app.isPackaged,
    recentFiles: recent.list(),
    onAction: (action) => sendMenuAction(mainWindow, action),
    onOpenRecent: (filePath) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send(IPC.menuAction, { action: "open-recent", filePath } satisfies MenuMessage);
    },
    onClearRecent: () => {
      recent.clear();
      refreshMenu(recent);
    },
    onCheckForUpdates: () => {
      void checkForUpdates().then((result) => {
        const detail =
          result.status === "available"
            ? `发现新版本 ${result.version}，请前往发布页下载。`
            : result.status === "up-to-date"
              ? `已是最新版本（${result.version}）。`
              : (result.message ?? "当前构建未配置更新源。");
        dialog.showMessageBox({
          type: "info",
          title: "检查更新",
          message: detail,
          buttons: ["好"],
        });
      });
    },
    onOpenDataDir: () => void shell.openPath(resolveResourcesPaths().dataDir),
    onOpenLogsDir: () => void shell.openPath(resolveResourcesPaths().logsDir),
    onShowShortcuts: () => {
      void dialog.showMessageBox({ type: "info", title: "键盘快捷键", message: shortcutsMessage(), buttons: ["好"] });
    },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let cachedPaths: ResourcePaths | null = null;
function resolveResourcesPaths(): ResourcePaths {
  if (cachedPaths) return cachedPaths;
  cachedPaths = resolveResources({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    desktopDir: join(__dirname, "..", ".."),
    userDataPath: app.getPath("userData"),
  });
  return cachedPaths;
}

async function bootstrap(): Promise<void> {
  const paths = resolveResourcesPaths();
  log().info("starting", {
    version: app.getVersion(),
    packaged: app.isPackaged,
    resources: paths.webDir,
    data: paths.dataDir,
  });

  embedded = await startEmbeddedServer(paths);
  origin = embedded.origin;
  log().info("api listening", { origin: embedded.origin });

  const recent = new RecentFilesStore(join(paths.stateDir, "recent-files.json"));

  registerIpcHandlers({
    paths,
    recent,
    logger: log(),
    getWindow: () => mainWindow,
    getOrigin: () => origin,
    checkForUpdates,
    openExternal,
  });

  mainWindow = openWindow(paths);
  refreshMenu(recent);
  openPendingProject();
}

/** A document passed on the command line (or via Finder) opens once ready. */
function openPendingProject(): void {
  if (!pendingProjectPath || !mainWindow) return;
  const filePath = pendingProjectPath;
  pendingProjectPath = null;
  const send = () => {
    mainWindow?.webContents.send(IPC.menuAction, { action: "open-recent", filePath } satisfies MenuMessage);
  };
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once("did-finish-load", send);
  else send();
}

/** Create (or re-create after macOS ⌘W) the single application window. */
function openWindow(paths: ResourcePaths): BrowserWindow {
  const window = createMainWindow({
    origin,
    preloadPath: join(__dirname, "..", "preload", "index.js"),
    stateFile: join(paths.stateDir, "window-state.json"),
    isDev: !app.isPackaged,
    openExternal,
  });
  window.on("closed", () => {
    mainWindow = null;
  });
  return window;
}

pendingProjectPath = takeProjectArgument(process.argv);
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  if (!isReadableProjectPath(filePath)) return;
  pendingProjectPath = filePath;
  openPendingProject();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const filePath = takeProjectArgument(argv);
    if (filePath) {
      pendingProjectPath = filePath;
      openPendingProject();
    }
  });

  app.whenReady().then(
    async () => {
      hardenSessionPermissions();
      // The stylesheet ships a single light palette; a dark window frame would
      // clash with the document surface.
      nativeTheme.themeSource = "light";
      app.setAboutPanelOptions({
        applicationName: APP_NAME,
        applicationVersion: app.getVersion(),
        version: `Electron ${process.versions.electron}`,
        credits: "本地优先的数据沙盘：文件不出本机。",
      });
      try {
        await bootstrap();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log().error("startup failed", { message });
        dialog.showErrorBox(
          "无法启动 What-if Report",
          `${message}\n\n日志：${log().filePath}`,
        );
        app.exit(1);
      }
    },
    (error) => {
      log().error("app ready failed", { message: String(error) });
      app.exit(1);
    },
  );

  app.on("activate", () => {
    if (mainWindow || !origin) return;
    mainWindow = openWindow(resolveResourcesPaths());
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", (event) => {
    if (quitting || !embedded) return;
    event.preventDefault();
    quitting = true;
    const server = embedded;
    void server
      .close()
      .catch((error: unknown) => log().warn("server shutdown failed", { message: String(error) }))
      .finally(() => {
        log().info("shutdown complete");
        app.exit(0);
      });
  });
}
