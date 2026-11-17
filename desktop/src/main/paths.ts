import { join } from "node:path";

export interface ResourcePaths {
  /** Directory holding index.html and assets/ for the SPA. */
  webDir: string;
  /** ESM entry of the embedded API server. */
  serverEntry: string;
  /** SQLite database, signing secret and other user data. */
  dataDir: string;
  /** Rotating log files for the shell and the API. */
  logsDir: string;
  /** Window bounds and recent-file list. */
  stateDir: string;
}

export interface ResourceInput {
  isPackaged: boolean;
  /** `process.resourcesPath` in a packaged app. */
  resourcesPath: string;
  /** Directory of the desktop package (`desktop/`). */
  desktopDir: string;
  /** `app.getPath('userData')`. */
  userDataPath: string;
}

/**
 * Packaged builds ship the web bundle and the API as `extraResources`, which
 * keeps the native SQLite binary outside the asar archive where it can be
 * dlopen'ed. Development runs against the same staging directory that the
 * packaging step produces, so both modes load byte-identical server code.
 */
export function resolveResources(input: ResourceInput): ResourcePaths {
  const root = input.isPackaged ? input.resourcesPath : join(input.desktopDir, "build");
  return {
    webDir: join(root, "web"),
    serverEntry: join(root, "server", "dist", "desktop", "embed.js"),
    dataDir: join(input.userDataPath, "data"),
    logsDir: join(input.userDataPath, "logs"),
    stateDir: join(input.userDataPath, "state"),
  };
}
