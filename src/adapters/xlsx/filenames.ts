/**
 * Default file names, kept in a dependency-free module so the shell and the
 * UI can reference them without pulling the SheetJS bundle into the first
 * paint. `downloadWorkbook` re-exports them for callers that already load it.
 */
export const CONFIRMED_XLSX_FILENAME = "what-if-report-confirmed.xlsx";
export const CONFIRMED_DOCX_FILENAME = "what-if-report-confirmed.docx";
