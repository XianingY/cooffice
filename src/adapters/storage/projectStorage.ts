import type { ProjectSnapshot } from "../../core/types";
import { validateSalesData } from "../../core/validation";

export const STORAGE_KEY = "what-if-report:project:v1";

/**
 * Persistence failures (quota exceeded, storage disabled) intentionally reach
 * the caller, which turns them into a non-blocking UI warning. Nothing besides
 * the versioned snapshot is ever written, and no file content is logged.
 */
export function saveProject(snapshot: ProjectSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearProject(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadProject(): ProjectSnapshot | null {
  // getItem exceptions are deliberately not swallowed here.
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as ProjectSnapshot;
    if (value.schemaVersion !== 1 || typeof value.updatedAt !== "string") return null;
    return {
      schemaVersion: 1,
      baseline: validateSalesData(value.baseline),
      draft: validateSalesData(value.draft),
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}
