import { BrowserWindow, screen } from "electron";
import { loadWindowState, saveWindowState, type Rect } from "./windowState.js";

export interface MainWindowOptions {
  origin: string;
  preloadPath: string;
  stateFile: string;
  isDev: boolean;
  openExternal(url: string): void;
}

function displaysAsRects(): Rect[] {
  return screen.getAllDisplays().map((display) => ({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
  }));
}

/**
 * The single application window.
 *
 * The renderer is loaded from the embedded server rather than from `file://`
 * so that cookies, fetch and SSE share one origin — the same security model the
 * browser deployment relies on, with no special cases.
 */
export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const bounds = loadWindowState(options.stateFile, displaysAsRects());
  const isMac = process.platform === "darwin";

  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 960,
    minHeight: 640,
    // Matches --bg in the app stylesheet so the first paint is not a white flash.
    backgroundColor: "#f5f7fa",
    title: "What-if Report · 数据沙盘",
    show: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: true,
    },
  });

  if (bounds.maximized) window.maximize();

  window.once("ready-to-show", () => window.show());

  let saveTimer: NodeJS.Timeout | undefined;
  const persist = () => {
    if (window.isDestroyed()) return;
    // getNormalBounds() reports the un-maximised frame, so restoring later
    // does not leave the window stuck at full-screen size.
    saveWindowState(options.stateFile, { ...window.getNormalBounds(), maximized: window.isMaximized() });
  };
  const schedulePersist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  };
  window.on("resize", schedulePersist);
  window.on("move", schedulePersist);
  window.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    persist();
  });

  window.on("page-title-updated", (event) => {
    // Keep the native title stable; the project name is shown in the header.
    event.preventDefault();
  });

  // External links open in the default browser instead of hijacking the shell.
  window.webContents.setWindowOpenHandler(({ url }) => {
    options.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(options.origin)) {
      event.preventDefault();
      options.openExternal(url);
    }
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());

  void window.loadURL(`${options.origin}/`);
  if (options.isDev && process.env.WHATIF_DEVTOOLS === "1") {
    window.webContents.openDevTools({ mode: "detach" });
  }
  return window;
}
