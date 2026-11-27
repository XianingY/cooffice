import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  AppInfo,
  DroppedFileResult,
  MenuAction,
  MenuMessage,
  OpenProjectResult,
  OpenSpreadsheetResult,
  PolishTextRequest,
  PolishTextResult,
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
import { PathAuthorizer } from "./pathAuthorizer.js";
import { normaliseTheme } from "./theme.js";
import type { RecentFilesStore } from "./recentFiles.js";
import type { ShellLogger } from "./logger.js";
import type { ResourcePaths } from "./paths.js";
import { runUpdateCheck, type UpdaterLike } from "./updater.js";

export interface IpcDeps {
  paths: ResourcePaths;
  recent: RecentFilesStore;
  authorizer: PathAuthorizer;
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
  /** Rebuild the native application menu whenever recent files change. */
  onRecentChanged?(): void;
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

/** Allow HTTPS endpoints (and localhost/127.0.0.1 HTTP for local LLM servers). */
export function isPolishEndpointAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1")
    );
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
 * The renderer never chooses an arbitrary path on its own: in-place writes and
 * reveal/recent reads are gated by the main-process PathAuthorizer and recent
 * files store so a compromised renderer cannot read or overwrite arbitrary
 * files on disk.
 */
export function registerIpcHandlers(deps: IpcDeps): void {
  const { logger, authorizer } = deps;

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
    if (target) {
      if (!authorizer.canWrite(target)) {
        logger.warn("unauthorized save target rejected", { target });
        return { canceled: true, error: "目标路径未获得写入授权，请通过保存对话框选择位置" };
      }
    } else {
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
      if (classifyFile(target) === "project") authorizer.allowWrite(target);
      else authorizer.allowReveal(target);
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
      authorizer.allowWrite(filePath);
      deps.recent.add(filePath);
      deps.onRecentChanged?.();
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
   * Native drops carry a path resolved via webUtils.getPathForFile. Reuse the
   * dialog readers so a drop cannot bypass extension, size or regular-file checks.
   */
  ipcMain.handle(IPC.openDroppedFile, async (_event, filePath: unknown): Promise<DroppedFileResult> => {
    if (typeof filePath !== "string" || filePath.length === 0) {
      return { kind: "unsupported", canceled: true, error: "拖入的路径无效" };
    }
    const kind = classifyFile(filePath);
    if (!kind) {
      logger.warn("dropped file ignored", { filePath });
      return { kind: "unsupported", canceled: true, error: "只支持 .whatif/.json 项目文件或 .xlsx/.xls/.csv 表格" };
    }
    try {
      const payload = kind === "project" ? readProjectFile(filePath) : readSpreadsheetFile(filePath);
      if (kind === "project") {
        authorizer.allowWrite(filePath);
        deps.recent.add(filePath);
        deps.onRecentChanged?.();
      }
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
    const known = deps.recent.list().includes(filePath) || authorizer.canWrite(filePath);
    if (!known) {
      logger.warn("unauthorized recent open rejected", { filePath });
      return { canceled: true, filePath, error: "该路径不在最近打开列表中" };
    }
    try {
      const payload = readProjectFile(filePath);
      authorizer.allowWrite(filePath);
      deps.recent.add(filePath);
      deps.onRecentChanged?.();
      return {
        canceled: false,
        filePath,
        name: payload.name,
        text: Buffer.from(payload.bytes).toString("utf8"),
      };
    } catch (error) {
      deps.recent.remove(filePath);
      deps.onRecentChanged?.();
      const message = error instanceof Error ? error.message : "项目文件已不可用";
      logger.warn("recent project missing", { filePath, message });
      return { canceled: true, filePath, error: message };
    }
  });

  ipcMain.handle(IPC.recentFiles, () => deps.recent.list());

  ipcMain.handle(IPC.revealPath, (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length === 0) return false;
    if (!authorizer.canReveal(filePath, [deps.paths.dataDir, deps.paths.logsDir])) {
      logger.warn("unauthorized reveal rejected", { filePath });
      return false;
    }
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
    if (!authorizer.canWrite(filePath)) return deps.recent.list();
    const updated = deps.recent.add(filePath);
    deps.onRecentChanged?.();
    return updated;
  });

  ipcMain.handle(IPC.checkForUpdates, () => deps.checkForUpdates());

  ipcMain.handle(IPC.openExternal, (_event, url: unknown) => {
    if (typeof url !== "string" || !isExternalUrlAllowed(url)) return false;
    deps.openExternal(url);
    return true;
  });

  /**
   * Main-process HTTPS proxy for opt-in AI copy polishing so the renderer can
   * keep strict `connect-src 'self'` CSP. Keys and texts are never logged or persisted.
   */
  ipcMain.handle(IPC.polishText, async (_event, request: PolishTextRequest): Promise<PolishTextResult> => {
    if (
      !request ||
      typeof request.endpoint !== "string" ||
      typeof request.model !== "string" ||
      typeof request.key !== "string" ||
      typeof request.text !== "string" ||
      !isPolishEndpointAllowed(request.endpoint)
    ) {
      return { error: "仅支持 HTTPS 或本机润色接口地址" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(request.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.key}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            {
              role: "system",
              content: "只润色中文报告的措辞,保持所有数字、单位和结论不变,不要新增事实。",
            },
            { role: "user", content: request.text },
          ],
        }),
      });
      if (!response.ok) return { error: `润色服务返回错误(${response.status})` };
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[]; text?: string };
      const polished = body.choices?.[0]?.message?.content ?? body.text ?? "";
      if (polished.trim() === "") return { error: "润色结果为空" };
      return { text: polished.trim() };
    } catch {
      return { error: "润色服务请求失败或超时" };
    } finally {
      clearTimeout(timer);
    }
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
export function sendMenuAction(window: BrowserWindow | null, action: MenuAction): void {
  if (!window || window.isDestroyed() || window.webContents.isLoading()) return;
  window.webContents.send(IPC.menuAction, { action } satisfies MenuMessage);
}

export function createUpdaterCheck(updater: UpdaterLike | null): () => Promise<UpdateCheckResult> {
  return () => runUpdateCheck(updater, app.getVersion());
}
