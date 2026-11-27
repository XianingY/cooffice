import { describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { isExternalUrlAllowed, isPolishEndpointAllowed, sendMenuAction } from "../src/main/ipc.js";
import { IPC } from "../src/shared/contract.js";

describe("desktop ipc helpers", () => {
  it("wraps native menu commands in a MenuMessage object", () => {
    const send = vi.fn();
    const fakeWindow = {
      isDestroyed: () => false,
      webContents: { isLoading: () => false, send },
    } as unknown as BrowserWindow;

    sendMenuAction(fakeWindow, "save-project");
    expect(send).toHaveBeenCalledWith(IPC.menuAction, { action: "save-project" });
  });

  it("ignores menu commands while the window is loading or destroyed", () => {
    const send = vi.fn();
    const loadingWindow = {
      isDestroyed: () => false,
      webContents: { isLoading: () => true, send },
    } as unknown as BrowserWindow;
    sendMenuAction(loadingWindow, "open-project");
    expect(send).not.toHaveBeenCalled();

    sendMenuAction(null, "open-project");
  });

  it("restricts external URLs and AI polish endpoints to safe protocols", () => {
    expect(isExternalUrlAllowed("https://example.com")).toBe(true);
    expect(isExternalUrlAllowed("file:///etc/passwd")).toBe(false);

    expect(isPolishEndpointAllowed("https://api.example.com/v1/chat/completions")).toBe(true);
    expect(isPolishEndpointAllowed("http://127.0.0.1:11434/v1/chat/completions")).toBe(true);
    expect(isPolishEndpointAllowed("http://localhost:8080/v1/chat/completions")).toBe(true);
    expect(isPolishEndpointAllowed("http://api.example.com/v1/chat/completions")).toBe(false);
    expect(isPolishEndpointAllowed("file:///etc/passwd")).toBe(false);
  });
});
