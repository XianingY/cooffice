import * as XLSX from "xlsx";
import type { SalesData } from "../../core/types";
import { createSalesWorkbook } from "./salesWorkbook";
import { CONFIRMED_DOCX_FILENAME, CONFIRMED_XLSX_FILENAME } from "./filenames";

export { CONFIRMED_DOCX_FILENAME, CONFIRMED_XLSX_FILENAME };
// Re-exported so existing callers keep one import site.
export { downloadBlob } from "../download";

/**
 * Always writes a new file from confirmed data; the original is untouched.
 *
 * Loaded lazily by the UI: SheetJS is ~420 kB of the first paint for a feature
 * most sessions never use.
 */
export function downloadSalesWorkbook(data: SalesData): void {
  XLSX.writeFile(createSalesWorkbook(data), CONFIRMED_XLSX_FILENAME);
}

/**
 * Workbook bytes for the desktop save dialog, which needs the payload in
 * memory rather than a browser-initiated download.
 */
export function createSalesWorkbookBytes(data: SalesData): Uint8Array {
  const written: ArrayBuffer | Uint8Array = XLSX.write(createSalesWorkbook(data), {
    type: "array",
    bookType: "xlsx",
  });
  return written instanceof Uint8Array ? written : new Uint8Array(written);
}
