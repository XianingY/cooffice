import { extname, resolve, sep } from "node:path";

const WRITABLE_EXTENSIONS = new Set(["whatif", "json", "xlsx", "docx"]);

/**
 * Session-scoped filesystem capability allowlist for the Electron main process.
 *
 * The renderer never gains arbitrary filesystem access: it may overwrite a
 * `targetPath` without a dialog only if the user explicitly opened or saved
 * that path earlier in this session, and it may reveal a path in the OS file
 * manager only if it belongs to this session or to the app's own data/logs.
 */
export class PathAuthorizer {
  private readonly writable = new Set<string>();
  private readonly revealable = new Set<string>();

  allowWrite(filePath: string): void {
    const abs = resolve(filePath);
    this.writable.add(abs);
    this.revealable.add(abs);
  }

  allowReveal(filePath: string): void {
    this.revealable.add(resolve(filePath));
  }

  canWrite(filePath: string): boolean {
    const abs = resolve(filePath);
    if (!this.writable.has(abs)) return false;
    const ext = extname(abs).slice(1).toLowerCase();
    return WRITABLE_EXTENSIONS.has(ext);
  }

  canReveal(filePath: string, allowedDirs: string[] = []): boolean {
    const abs = resolve(filePath);
    if (this.revealable.has(abs)) return true;
    return allowedDirs.some((dir) => {
      const root = resolve(dir);
      return abs === root || abs.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
    });
  }
}
