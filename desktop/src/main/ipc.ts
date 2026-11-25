import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  AppInfo,
  DroppedFileResult,
  OpenProjectResult,
  OpenSpreadsheetResult,
  SaveFileRequest,
  SaveFileResult,
  ThemeSetting,
  ThemeState,
  UpdateCheckResult,
} from "../shared/contract.js";
import { IPC } from "../shared/contract.js";
import {
  classifyFile,
  readProjectFile,
  readSpreadsheetFile,
  writeFileBytes,
  PROJECT_EXTENSIONS,
  SPREADSHEET_EXTENSIONS,
} from "./fileAccess.js";
import { normaliseTheme } from "./theme.js";
import type { RecentFilesStore } from "./recentFiles.js";
import type { ShellLogger } from "./logger.js";
import type { ResourcePaths } from "./paths.js";
import { runUpdateCheck, type UpdaterLike } from "./updater.js";

export interface IpcDeps {
  paths: ResourcePaths;
  recent: RecentFilesStore;
  logger: ShellLogger;
  getWindow(): BrowserWindow | null;
  getOrigin(): string;
  getSessionToken(): string;
  getThemeState(): ThemeState;
  setTheme(setting: ThemeSetting): ThemeState;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openExternal(url: string): void;
  /** Mirrors the renderer's dirty flag so the window can guard closing. */
  setDocumentEdited(dirty: boolean): void;
}

/** Only http(s) and mailto links may leave the app. */
export function isExternalUrlAllowed(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

function documentsPath(): string {
  try {
    return app.getPath("documents");
  } catch {
    return app.getPath("home");
  }
}

/** Attach the parent window to a dialog when one is available. */
async function saveDialog(
  window: BrowserWindow | null,
  options: Electron.SaveDialogOptions,
): Promise<Electron.SaveDialogReturnValue> {
  return window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options);
}

async function openDialog(
  window: BrowserWindow | null,
  options: Electron.OpenDialogOptions,
): Promise<Electron.OpenDialogReturnValue> {
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options);
}

/**
 * Dialog + filesystem bridge for the renderer.
 *
 * The renderer never chooses a path on its own: it either supplies bytes for a
 * save dialog or asks for a file that the user picked in an open dialog. That
 * keeps the IPC surface from becoming a general-purpose filesystem API.
 */
export function registerIpcHandlers(deps: IpcDeps): void {
  const { logger } = deps;

  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    appName: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
    dataDir: deps.paths.dataDir,
    logsDir: deps.paths.logsDir,
  }));

  ipcMain.handle(IPC.saveFile, async (_event, request: SaveFileRequest): Promise<SaveFileResult> => {
    const window = deps.getWindow();
    if (!request || typeof request.suggestedName !== "string" || !(request.data instanceof Uint8Array)) {
      return { canceled: true, error: "保存请求无效" };
    }
    let target = request.targetPath;
    if (!target) {
      const result = await saveDialog(window, {
        title: "保存文件",
        defaultPath: join(documentsPath(), basename(request.suggestedName)),
        filters: [
          {
            name: request.filterName ?? "文件",
            extensions: request.extensions ?? [request.suggestedName.split(".").pop() ?? "dat"],
          },
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"],
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      target = result.filePath;
    }
    try {
      writeFileBytes(target, request.data);
      logger.info("file saved", { target, bytes: request.data.byteLength });
      return { canceled: false, filePath: target };
    } catch (error) {
      const message = error instanceof Error ? error.message : "写入文件失败";
      logger.error("file save failed", { target, message });
      return { canceled: true, error: message };
    }
  });

  ipcMain.handle(IPC.openProject, async (): Promise<OpenProjectResult> => {
    const window = deps.getWindow();
    const result = await openDialog(window, {
      title: "打开项目文件",
      defaultPath: documentsPath(),
      filters: [{ name: "What-if 项目", extensions: PROJECT_EXTENSIONS }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    try {
      const payload = readProjectFile(filePath);
      deps.recent.add(filePath);
      return {
        canceled: false,
        filePath,
        name: payload.name,
        text: Buffer.from(payload.bytes).toString("utf8"),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法读取项目文件";
      logger.warn("project open failed", { filePath, message });
      return { canceled: true, filePath, error: message };
    }
  });

  ipcMain.handle(IPC.openSpreadsheet, async (): Promise<OpenSpreadsheetResult> => {
    const window = deps.getWindow();
    const result = await openDialog(window, {
      title: "导入 Excel 或 CSV",
      defaultPath: documentsPath(),
      filters: [{ name: "表格文件", extensions: SPREADSHEET_EXTENSIONS }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const filePath = result.filePaths[0];
    try {
      const payload = readSpreadsheetFile(filePath);
      return { canceled: false, filePath, name: payload.name, bytes: payload.bytes };
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法读取表格文件";
      logger.warn("spreadsheet open failed", { filePath, message });
      return { canceled: true, filePath, error: message };
    }
  });

  /**
   * Native drops carry a path, not bytes. Reuse the dialog readers so a drop
   * cannot bypass extension, size or regular-file checks.
   */
  ipcMain.handle(IPC.openDroppedFile, async (_event, filePath: unknown): Promise<DroppedFileResult> => {
    if (typeof filePath !== "string" || filePath.length === 0) {
      return { kind: "unsupported", canceled: true, error: "拖入的路径无效" };
    }
    const kind = classifyFile(filePath);
    if (!kind) {
      logger.warn("dropped file ignored", { filePath });
      return { kind: "unsupported", canceled: true, error: "只支持 .json 项目文件或 .xlsx/.xls/.csv 表格" };
    }
    try {
      const payload = kind === "project" ? readProjectFile(filePath) : readSpreadsheetFile(filePath);
      if (kind === "project") deps.recent.add(filePath);
      logger.info("file dropped", { filePath, kind, bytes: payload.bytes.byteLength });
      return { kind, canceled: false, filePath, name: payload.name, bytes: payload.bytes };
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法读取拖入的文件";
      logger.warn("dropped file rejected", { filePath, message });
      return { kind, canceled: true, error: message };
    }
  });

  ipcMain.handle(IPC.openRecent, async (_event, filePath: unknown): Promise<OpenProjectResult> => {
    if (typeof filePath !== "string" || filePath.length === 0) return { canceled: true, error: "路径无效" };
    try {
      const payload = readProjectFile(filePath);
      deps.recent.add(filePath);
      return {
        canceled: false,
        filePath,
        name: payload.name,
        text: Buffer.from(payload.bytes).toString("utf8"),
      };
    } catch (error) {
      deps.recent.remove(filePath);
      const message = error instanceof Error ? error.message : "项目文件已不可用";
      logger.warn("recent project missing", { filePath, message });
      return { canceled: true, filePath, error: message };
    }
  });

  ipcMain.handle(IPC.recentFiles, () => deps.recent.list());

  ipcMain.handle(IPC.revealPath, (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) return false;
    try {
      if (statSync(filePath).isFile()) {
        shell.showItemInFolder(filePath);
        return true;
      }
    } catch {
      // Fall through to the directory case.
    }
    try {
      void shell.openPath(dirname(filePath));
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.on(IPC.setDirty, (_event, dirty: unknown) => {
    deps.setDocumentEdited(dirty === true);
  });

  ipcMain.handle(IPC.setCurrentFile, (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) return [];
    return deps.recent.add(filePath);
  });

  ipcMain.handle(IPC.checkForUpdates, () => deps.checkForUpdates());

  ipcMain.handle(IPC.openExternal, (_event, url: unknown) => {
    if (typeof url !== "string" || !isExternalUrlAllowed(url)) return false;
    deps.openExternal(url);
    return true;
  });

  // Synchronous on purpose: the renderer needs the token before its first call.
  ipcMain.on(IPC.sessionToken, (event) => {
    event.returnValue = deps.getSessionToken();
  });

  // Also synchronous: applying the palette before first paint avoids a flash.
  ipcMain.on(IPC.themeState, (event) => {
    event.returnValue = deps.getThemeState();
  });
  ipcMain.handle(IPC.themeSet, (_event, setting: unknown): ThemeState =>
    deps.setTheme(normaliseTheme(setting)),
  );

  ipcMain.handle(IPC.openDataDir, () => shell.openPath(deps.paths.dataDir));
  ipcMain.handle(IPC.openLogsDir, () => shell.openPath(deps.paths.logsDir));

  ipcMain.on(IPC.log, (_event, level: unknown, message: unknown, meta: unknown) => {
    const text = typeof message === "string" ? message : JSON.stringify(message);
    const extra = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : undefined;
    if (level === "error") logger.error(text, extra);
    else if (level === "warn") logger.warn(text, extra);
    else logger.info(text, extra);
  });
}

/** Send a menu command to the renderer; ignored while the window is loading. */
export function sendMenuAction(window: BrowserWindow | null, action: string): void {
  if (!window || window.isDestroyed() || window.webContents.isLoading()) return;
  window.webContents.send(IPC.menuAction, action);
}

export function createUpdaterCheck(updater: UpdaterLike | null): () => Promise<UpdateCheckResult> {
  return () => runUpdateCheck(updater, app.getVersion());
}
