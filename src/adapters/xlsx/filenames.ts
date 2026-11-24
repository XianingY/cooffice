/**
 * Default file names, kept in a dependency-free module so the shell and the
 * UI can reference them without pulling the SheetJS bundle into the first
 * paint. `downloadWorkbook` re-exports them for callers that already load it.
 */
export const CONFIRMED_XLSX_FILENAME = "what-if-report-confirmed.xlsx";
export const CONFIRMED_DOCX_FILENAME = "what-if-report-confirmed.docx";

// A draft export must not overwrite the confirmed export: the two snapshots
// answer different questions and users keep both side by side.
export const DRAFT_XLSX_FILENAME = "what-if-report-draft.xlsx";
export const DRAFT_DOCX_FILENAME = "what-if-report-draft.docx";
