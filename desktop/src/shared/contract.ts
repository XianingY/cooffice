/**
 * Contract between the Electron main process, the preload bridge and the
 * renderer. Channel names live here so a typo cannot silently disconnect the
 * two halves; the renderer keeps a mirror of the types in `src/desktop`.
 */
export const IPC = {
  appInfo: "desktop:app-info",
  saveFile: "desktop:save-file",
  openProject: "desktop:open-project",
  openSpreadsheet: "desktop:open-spreadsheet",
  openDroppedFile: "desktop:open-dropped-file",
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
  themeState: "desktop:theme-state",
  themeSet: "desktop:theme-set",
  themeChanged: "desktop:theme-changed",
  log: "desktop:log",
} as const;

export type ThemeSetting = "system" | "light" | "dark";
export type AppliedTheme = "light" | "dark";

/** Theme choice plus the palette the window actually resolved to. */
export interface ThemeState {
  setting: ThemeSetting;
  resolved: AppliedTheme;
}

export type MenuAction =
  | "open-project"
  | "save-project"
  | "export-excel"
  | "export-word"
  | "import-spreadsheet"
  | "clear-project"
  | "open-recent";

/** Menu command forwarded to the renderer. */
export interface MenuMessage {
  action: MenuAction;
  /** Present for `open-recent`; the renderer then reads it through IPC. */
  filePath?: string;
}

export interface SaveFileRequest {
  suggestedName: string;
  /** Raw bytes; structured-cloned over IPC as a Uint8Array. */
  data: Uint8Array;
  filterName?: string;
  extensions?: string[];
  /** Overwrite silently when the user already picked a path (⌘S behaviour). */
  targetPath?: string;
}

export interface SaveFileResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenProjectResult {
  canceled: boolean;
  filePath?: string;
  name?: string;
  text?: string;
  error?: string;
}

export interface OpenSpreadsheetResult {
  canceled: boolean;
  filePath?: string;
  name?: string;
  bytes?: Uint8Array;
  error?: string;
}

/**
 * A file dragged onto the window, read by the main process so the renderer
 * never gains a general-purpose filesystem API.
 */
export interface DroppedFileResult {
  kind: "project" | "spreadsheet" | "unsupported";
  canceled: boolean;
  filePath?: string;
  name?: string;
  bytes?: Uint8Array;
  error?: string;
}

export interface AppInfo {
  appName: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: NodeJS.Platform;
  arch: string;
  isPackaged: boolean;
  dataDir: string;
  logsDir: string;
}

export interface UpdateCheckResult {
  status: "unconfigured" | "checking" | "up-to-date" | "available" | "error";
  version?: string;
  message?: string;
}
