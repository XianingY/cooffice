import { parseProjectFile } from "../../core/projectFile";
import type { ProjectFileSnapshot } from "../../core/types";

export const PROJECT_FILE_EXTENSION = ".json";
export const PROJECT_FILE_FILENAME = "what-if-report-project.json";

/** Read a versioned project document from disk; never trusts file contents. */
export async function readProjectFile(file: File): Promise<ProjectFileSnapshot> {
  if (!file.name.toLowerCase().endsWith(PROJECT_FILE_EXTENSION)) {
    throw new Error("只支持 .json 文件");
  }
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("项目文件无法解析，请检查文件后重试");
  }
  // Validation errors from the core are shown verbatim so bad data is
  // distinguishable from a corrupt JSON document.
  return parseProjectFile(value);
}

/** Download the current baseline/draft as a portable JSON document. */
export function downloadProjectFile(snapshot: ProjectFileSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = PROJECT_FILE_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
