import { useEffect, useRef } from "react";
import { applyDesktopShellChrome, type DesktopBridge } from "../desktop/bridge";

export interface DesktopMenuActions {
  openProjectFromDisk(): Promise<void>;
  openRecentProject(filePath: string): Promise<void>;
  handleExportProject(inPlace?: boolean): Promise<void>;
  handleExportExcel(): Promise<void>;
  handleExportWord(): Promise<void>;
  importSpreadsheetFromDisk(): Promise<void>;
  requestClear(): void;
}

/**
 * Bind Electron native menu commands to the same handlers the toolbar uses.
 * Keeps a ref so the IPC listener is registered once for the app lifetime.
 */
export function useDesktopMenu(desktop: DesktopBridge | null, actions: DesktopMenuActions): void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!desktop) return undefined;
    applyDesktopShellChrome();
    return desktop.onMenuAction(({ action, filePath }) => {
      const current = actionsRef.current;
      switch (action) {
        case "open-project":
          void current.openProjectFromDisk();
          break;
        case "save-project":
          void current.handleExportProject(true);
          break;
        case "export-excel":
          void current.handleExportExcel();
          break;
        case "export-word":
          void current.handleExportWord();
          break;
        case "import-spreadsheet":
          void current.importSpreadsheetFromDisk();
          break;
        case "clear-project":
          current.requestClear();
          break;
        case "open-recent":
          if (filePath) void current.openRecentProject(filePath);
          break;
        default:
          break;
      }
    });
  }, [desktop]);
}
