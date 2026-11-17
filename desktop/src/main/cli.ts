import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";

/**
 * Pick a project document out of the launch arguments.
 *
 * macOS delivers "open with" through an `open-file` event, but Windows and
 * Linux pass the path on the command line. Only existing `.json` files are
 * considered, so the Electron binary path itself can never be mistaken for a
 * document.
 */
export function takeProjectArgument(
  argv: string[],
  fileExists: (path: string) => boolean = existsSync,
): string | null {
  for (const argument of argv.slice(1)) {
    if (!argument || argument.startsWith("-")) continue;
    if (extname(argument).toLowerCase() !== ".json") continue;
    if (!fileExists(argument)) continue;
    return argument;
  }
  return null;
}

/** Guard for paths that arrive from the OS rather than from a dialog. */
export function isReadableProjectPath(path: string): boolean {
  try {
    return statSync(path).isFile() && extname(path).toLowerCase() === ".json";
  } catch {
    return false;
  }
}
