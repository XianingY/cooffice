import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const MIN_SECRET_LENGTH = 16;

/**
 * Load the per-installation JWT signing secret, creating it on first launch.
 *
 * Desktop installs have no operator to inject a secret, and a hard-coded one
 * would be identical across machines. Generating 32 random bytes per profile
 * keeps refresh tokens from being forgeable elsewhere; file mode 0600 keeps it
 * out of reach of other users on the same machine.
 */
export function loadOrCreateSecret(path: string): { secret: string; created: boolean } {
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8").trim();
    if (existing.length >= MIN_SECRET_LENGTH) return { secret: existing, created: false };
    // A truncated file is not usable; regenerate rather than fail to start.
  }
  mkdirSync(dirname(path), { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(path, `${secret}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    // writeFileSync honours the mode only when creating the file; enforce it in
    // case an earlier run created it with a wider umask.
    chmodSync(path, 0o600);
  } catch {
    // Best effort: Windows and some network filesystems ignore POSIX modes.
  }
  return { secret, created: true };
}
