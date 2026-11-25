import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedWindow {
  options: Record<string, unknown>;
  handlers: Map<string, (...args: unknown[]) => void>;
  webHandlers: Map<string, (...args: unknown[]) => void>;
  openDevTools: ReturnType<typeof vi.fn>;
}

const captured: CapturedWindow[] = [];

vi.mock("electron", () => ({
  screen: {
    getAllDisplays: () => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }],
  },
  BrowserWindow: class {
    options: Record<string, unknown>;
    handlers = new Map<string, (...args: unknown[]) => void>();
    webHandlers = new Map<string, (...args: unknown[]) => void>();
    openDevTools = vi.fn();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      captured.push(this as unknown as CapturedWindow);
    }
    once(name: string, handler: (...args: unknown[]) => void) { this.handlers.set(name, handler); }
    on(name: string, handler: (...args: unknown[]) => void) { this.handlers.set(name, handler); }
    maximize() {}
    show() {}
    isDestroyed() { return true; }
    loadURL() { return Promise.resolve(); }
    webContents = {
      on: (name: string, handler: (...args: unknown[]) => void) => this.webHandlers.set(name, handler),
      setWindowOpenHandler: () => undefined,
      openDevTools: (...args: unknown[]) => this.openDevTools(...args),
    };
  },
}));

vi.mock("../src/main/windowState.js", () => ({
  loadWindowState: () => ({ width: 1280, height: 860 }),
  saveWindowState: () => undefined,
}));

import { createMainWindow } from "../src/main/window.js";

function makeWindow(isDev: boolean): CapturedWindow {
  createMainWindow({
    origin: "http://127.0.0.1:3001",
    preloadPath: "/preload.js",
    stateFile: "/tmp/state.json",
    isDev,
    openExternal: () => undefined,
  });
  return captured[captured.length - 1];
}

describe("main window devtools", () => {
  beforeEach(() => {
    captured.length = 0;
    delete process.env.WHATIF_DEVTOOLS;
  });

  it("disables devtools webPreferences in a packaged app", () => {
    const window = makeWindow(false);
    const prefs = window.options.webPreferences as Record<string, unknown>;
    expect(prefs.devTools).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.sandbox).toBe(true);
    expect(window.openDevTools).not.toHaveBeenCalled();
  });

  it("keeps devtools available in development", () => {
    const window = makeWindow(true);
    const prefs = window.options.webPreferences as Record<string, unknown>;
    expect(prefs.devTools).toBe(true);
  });

  it("only auto-opens devtools in development with the opt-in flag", () => {
    process.env.WHATIF_DEVTOOLS = "1";
    const packaged = makeWindow(false);
    expect(packaged.openDevTools).not.toHaveBeenCalled();

    const dev = makeWindow(true);
    expect(dev.openDevTools).toHaveBeenCalledWith({ mode: "detach" });
  });
});
