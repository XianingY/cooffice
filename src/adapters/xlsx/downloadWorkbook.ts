import * as XLSX from "xlsx";
import type { SalesData } from "../../core/types";
import { createSalesWorkbook } from "./salesWorkbook";

export const CONFIRMED_XLSX_FILENAME = "what-if-report-confirmed.xlsx";
export const CONFIRMED_DOCX_FILENAME = "what-if-report-confirmed.docx";

/** Always writes a new file from confirmed data; the original is untouched. */
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

/** Shared browser download helper for generated Blobs (Word and future formats). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
