import { parseProjectFile } from "../../core/projectFile";
import type { ProjectFileSnapshot } from "../../core/types";

// Stable key from v0.1.0. The stored value is now a schemaVersion 3 document;
// parseProjectFile migrates legacy v1/v2 values on read.
export const STORAGE_KEY = "what-if-report:project:v1";

/**
 * Persistence failures (quota exceeded, storage disabled) intentionally reach
 * the caller, which turns them into a non-blocking UI warning. Only the
 * versioned project document is written; no file content is logged.
 */
export function saveProject(snapshot: ProjectFileSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadProject(): ProjectFileSnapshot | null {
  // getItem exceptions are deliberately not swallowed here.
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    return parseProjectFile(JSON.parse(raw));
  } catch {
    return null;
  }
}
