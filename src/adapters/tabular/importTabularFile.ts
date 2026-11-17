import { readCsvFile } from "../csv/salesCsv";
import { suggestColumnMapping } from "../../core/columnMapping";
import type { ColumnMapping, SalesData, TabularInput } from "../../core/types";

export type TabularImport =
  | { kind: "data"; data: SalesData }
  | { kind: "csv"; input: TabularInput; suggested: ColumnMapping };

/**
 * Single entry point for "the user picked a spreadsheet".
 *
 * Shared by the file input and the desktop open dialog so both routes validate
 * and map columns identically; CSV still needs the mapping step, Excel does
 * not. The workbook reader — and with it SheetJS — is imported on demand so it
 * stays out of the initial bundle.
 */
export async function importTabularFile(file: File): Promise<TabularImport> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const input = await readCsvFile(file);
    return { kind: "csv", input, suggested: suggestColumnMapping(input) };
  }
  const { readSalesFile } = await import("../xlsx/salesWorkbook");
  return { kind: "data", data: await readSalesFile(file) };
}
