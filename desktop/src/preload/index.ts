import { contextBridge, ipcRenderer } from "electron";

/**
 * Sandboxed preload: no Node built-ins and no relative requires are available
 * here, so the channel names are inlined and `test/contract.test.ts` asserts
 * they stay identical to `shared/contract.ts`.
 */
const CHANNELS = {
  appInfo: "desktop:app-info",
  saveFile: "desktop:save-file",
  openProject: "desktop:open-project",
  openSpreadsheet: "desktop:open-spreadsheet",
  revealPath: "desktop:reveal-path",
  setDirty: "desktop:set-dirty",
  setCurrentFile: "desktop:set-current-file",
  recentFiles: "desktop:recent-files",
  openRecent: "desktop:open-recent",
  checkForUpdates: "desktop:check-for-updates",
  openExternal: "desktop:open-external",
  openDataDir: "desktop:open-data-dir",
  openLogsDir: "desktop:open-logs-dir",
  menuAction: "desktop:menu-action",
  sessionToken: "desktop:session-token",
  log: "desktop:log",
} as const;

export const desktopApi = {
  isDesktop: true as const,
  platform: process.platform,

  /** Persist bytes through a native save dialog (or the known target path). */
  saveFile: (request: {
    suggestedName: string;
    data: Uint8Array;
    filterName?: string;
    extensions?: string[];
    targetPath?: string;
  }) => ipcRenderer.invoke(CHANNELS.saveFile, request),

  openProject: () => ipcRenderer.invoke(CHANNELS.openProject),
  openSpreadsheet: () => ipcRenderer.invoke(CHANNELS.openSpreadsheet),
  openRecent: (filePath: string) => ipcRenderer.invoke(CHANNELS.openRecent, filePath),
  recentFiles: () => ipcRenderer.invoke(CHANNELS.recentFiles),
  revealPath: (filePath: string) => ipcRenderer.invoke(CHANNELS.revealPath, filePath),

  setDirty: (dirty: boolean) => ipcRenderer.send(CHANNELS.setDirty, dirty),
  /** Remember the open document so ⌘S can overwrite it and it joins "最近打开". */
  setCurrentFile: (filePath: string) => ipcRenderer.invoke(CHANNELS.setCurrentFile, filePath),

  appInfo: () => ipcRenderer.invoke(CHANNELS.appInfo),
  checkForUpdates: () => ipcRenderer.invoke(CHANNELS.checkForUpdates),
  openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.openExternal, url),
  /**
   * Per-launch token the API requires on every request. Fetched synchronously
   * once so the first API call already carries it.
   */
  getSessionToken: (): string => {
    const token = ipcRenderer.sendSync(CHANNELS.sessionToken) as unknown;
    return typeof token === "string" ? token : "";
  },

  openDataDir: () => ipcRenderer.invoke(CHANNELS.openDataDir),
  openLogsDir: () => ipcRenderer.invoke(CHANNELS.openLogsDir),
  log: (level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) =>
    ipcRenderer.send(CHANNELS.log, level, message, meta),

  /** Subscribe to menu commands; returns an unsubscribe function. */
  onMenuAction: (handler: (message: { action: string; filePath?: string }) => void) => {
    const listener = (_event: unknown, message: { action: string; filePath?: string }) => handler(message);
    ipcRenderer.on(CHANNELS.menuAction, listener);
    return () => {
      ipcRenderer.removeListener(CHANNELS.menuAction, listener);
    };
  },
};

export type DesktopApi = typeof desktopApi;

contextBridge.exposeInMainWorld("desktop", desktopApi);
