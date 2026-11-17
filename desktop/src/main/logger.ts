import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";

export interface ShellLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  readonly filePath: string;
}

/**
 * Append-only JSON-lines log with single-file rotation.
 *
 * Packaged apps have no terminal, so every failure the user might report needs
 * to land somewhere they can find from Help ▸ 打开日志目录.
 */
export function createShellLogger(filePath: string, maxBytes = 2 * 1024 * 1024): ShellLogger {
  const ensureDir = () => {
    try {
      mkdirSync(dirname(filePath), { recursive: true });
    } catch {
      // A read-only profile directory must not crash the shell.
    }
  };

  const rotateIfNeeded = () => {
    try {
      if (!existsSync(filePath)) return;
      if (statSync(filePath).size < maxBytes) return;
      renameSync(filePath, `${filePath}.1`);
    } catch {
      // Rotation is best effort.
    }
  };

  const write = (level: string, message: string, meta?: Record<string, unknown>) => {
    ensureDir();
    rotateIfNeeded();
    const entry = { time: new Date().toISOString(), level, message, ...(meta ?? {}) };
    try {
      appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      // Logging must never throw into application code.
    }
  };

  return {
    filePath,
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}
