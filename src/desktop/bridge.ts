/**
 * Renderer-side handle on the Electron shell.
 *
 * Everything here degrades to plain browser behaviour when the app runs in a
 * tab: the desktop build is additive, so the same bundle keeps working on the
 * web with zero desktop assumptions.
 */

export interface SaveFileRequest {
  suggestedName: string;
  data: Uint8Array;
  filterName?: string;
  extensions?: string[];
  targetPath?: string;
}

export interface SaveFileResult {
  canceled: boolean;
  filePath?: string;
  error?: string;
}

export interface OpenDocumentResult {
  canceled: boolean;
  filePath?: string;
  name?: string;
  text?: string;
  bytes?: Uint8Array;
  error?: string;
}

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
  platform: string;
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

export interface MenuMessage {
  action: string;
  filePath?: string;
}

export type ThemeSetting = "system" | "light" | "dark";
export type AppliedTheme = "light" | "dark";

export interface ThemeState {
  setting: ThemeSetting;
  resolved: AppliedTheme;
}

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  saveFile(request: SaveFileRequest): Promise<SaveFileResult>;
  openProject(): Promise<OpenDocumentResult>;
  openSpreadsheet(): Promise<OpenDocumentResult>;
  openDroppedFile(filePath: string): Promise<DroppedFileResult>;
  openRecent(filePath: string): Promise<OpenDocumentResult>;
  recentFiles(): Promise<string[]>;
  revealPath(filePath: string): Promise<boolean>;
  setDirty(dirty: boolean): void;
  setCurrentFile(filePath: string): Promise<string[]>;
  appInfo(): Promise<AppInfo>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openExternal(url: string): Promise<boolean>;
  getSessionToken(): string;
  /** Synchronous so the palette can be applied before the first paint. */
  getTheme(): ThemeState;
  setTheme(setting: ThemeSetting): Promise<ThemeState>;
  onThemeChange(handler: (state: ThemeState) => void): () => void;
  openDataDir(): Promise<string>;
  openLogsDir(): Promise<string>;
  log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>): void;
  onMenuAction(handler: (message: MenuMessage) => void): () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export function getDesktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.desktop;
  return bridge && bridge.isDesktop === true ? bridge : null;
}

export const isDesktop = (): boolean => getDesktop() !== null;

/** Path of the document the user opened, so ⌘S can overwrite it in place. */
let currentFilePath: string | null = null;

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function forgetCurrentFilePath(): void {
  currentFilePath = null;
}

/** Remember an opened document: window title, recent-files menu and ⌘S target. */
export function trackDocument(filePath: string): void {
  currentFilePath = filePath;
  const bridge = getDesktop();
  if (bridge) void bridge.setCurrentFile(filePath);
}

/**
 * Mark the window as having unsaved changes (macOS shows a dot in the close
 * button). Mirrors the app's "unapplied draft" state.
 */
export function setDocumentEdited(dirty: boolean): void {
  getDesktop()?.setDirty(dirty);
}

/** Tag `<html>` so the stylesheet can reserve room for the traffic lights. */
export function applyDesktopShellChrome(): void {
  const bridge = getDesktop();
  if (!bridge || typeof document === "undefined") return;
  document.documentElement.dataset.desktop = "true";
  document.documentElement.dataset.platform = bridge.platform;
}

/**
 * Headers the embedded API requires alongside the bearer token. Empty in the
 * browser build, where no per-launch token exists.
 */
export function sessionHeaders(): Record<string, string> {
  const bridge = getDesktop();
  const token = bridge?.getSessionToken?.() ?? "";
  return token ? { "x-whatif-session": token } : {};
}

export function toBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

/** Build a Blob from a typed array without exposing the underlying buffer. */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

export interface SaveBlobOptions {
  suggestedName: string;
  filterName?: string;
  extensions?: string[];
  /** Overwrite the open document instead of prompting. */
  inPlace?: boolean;
}

export interface SaveBlobOutcome {
  saved: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Save generated bytes through the native dialog, or fall back to the browser
 * download flow when no shell is present.
 */
export async function saveBlob(blob: Blob, options: SaveBlobOptions): Promise<SaveBlobOutcome> {
  const bridge = getDesktop();
  if (!bridge) {
    const { downloadBlob } = await import("../adapters/download");
    downloadBlob(blob, options.suggestedName);
    return { saved: true };
  }
  const result = await bridge.saveFile({
    suggestedName: options.suggestedName,
    data: await toBytes(blob),
    filterName: options.filterName,
    extensions: options.extensions,
    targetPath: options.inPlace ? (currentFilePath ?? undefined) : undefined,
  });
  if (result.canceled) return { saved: false, canceled: true, error: result.error, filePath: result.filePath };
  return { saved: true, filePath: result.filePath };
}

/** Build a `File` from an Electron-provided payload so adapters stay unchanged. */
export function toFile(name: string, bytes: Uint8Array): File {
  return new File([new Uint8Array(bytes)], name);
}

/** Electron adds an absolute path to files that came from a native drag. */
export function filePathOf(file: File): string | null {
  const path = (file as File & { path?: unknown }).path;
  return typeof path === "string" && path.length > 0 ? path : null;
}

/** Human-readable location for "saved to …" notices. */
export function shortPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return filePath;
  return `…/${parts.slice(-2).join("/")}`;
}
