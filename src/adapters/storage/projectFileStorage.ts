import { parseProjectFile } from "../../core/projectFile";
import type { ProjectFileSnapshot } from "../../core/types";

export const PROJECT_FILE_EXTENSION = ".json";
export const PROJECT_FILE_FILENAME = "what-if-report-project.json";

/**
 * Parse a project document from already-read text.
 *
 * Validation errors from the core are surfaced verbatim so that bad data is
 * distinguishable from a corrupt JSON document.
 */
export function parseProjectFileText(text: string): ProjectFileSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("项目文件无法解析，请检查文件后重试");
  }
  return parseProjectFile(value);
}

/** Read a versioned project document from disk; never trusts file contents. */
export async function readProjectFile(file: File): Promise<ProjectFileSnapshot> {
  if (!file.name.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)) {
    throw new Error("只支持 .json 文件");
  }
  return parseProjectFileText(await file.text());
}

/** Serialise a snapshot the way the desktop shell writes it to disk. */
export function serialiseProjectFile(snapshot: ProjectFileSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/** Download the current baseline/draft as a portable JSON document. */
export function downloadProjectFile(snapshot: ProjectFileSnapshot): void {
  const blob = new Blob([serialiseProjectFile(snapshot)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = PROJECT_FILE_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
