import type { UpdateCheckResult } from "../shared/contract.js";

/**
 * Minimal surface of `electron-updater` that we rely on, kept as an interface
 * so the decision logic is testable without an Electron runtime.
 */
export interface UpdaterLike {
  checkForUpdates(): Promise<{ updateInfo?: { version?: string } } | null | undefined>;
}

/** Environment override for builds distributed outside a publish config. */
export function resolveUpdateFeed(source: NodeJS.ProcessEnv = process.env): string | null {
  const value = source.WHATIF_UPDATE_FEED?.trim();
  if (!value) return null;
  if (!/^https:\/\//.test(value)) return null;
  return value;
}

/**
 * Ask the updater for a release and translate the outcome into a status the
 * UI can show verbatim. Without a feed the app reports `unconfigured` rather
 * than pretending an update check happened.
 */
export async function runUpdateCheck(
  updater: UpdaterLike | null,
  currentVersion: string,
): Promise<UpdateCheckResult> {
  if (!updater) {
    return {
      status: "unconfigured",
      message: "当前构建未配置更新源，更新需手动下载新版安装包。",
    };
  }
  try {
    const result = await updater.checkForUpdates();
    const version = result?.updateInfo?.version;
    if (version && version !== currentVersion) {
      return { status: "available", version };
    }
    return { status: "up-to-date", version: currentVersion };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "检查更新失败",
    };
  }
}
