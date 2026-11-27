import * as XLSX from "xlsx";
import { validateSalesData } from "../../core/validation";
import type { SalesData } from "../../core/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REGIONS = 1000;
const EXPECTED_HEADERS = ["region", "previous", "current"] as const;

const cellAt = (sheet: XLSX.WorkSheet, address: string): XLSX.CellObject | undefined =>
  sheet[address] as XLSX.CellObject | undefined;

function assertNoFormula(cells: (XLSX.CellObject | undefined)[]): void {
  if (cells.some((cell) => cell?.f)) {
    throw new Error("输入文件不能包含公式");
  }
}

/**
 * Read the fixed Sales template. Rows are visited by their real spreadsheet
 * row number (not by array index) so skipping a blank row cannot shift the
 * B/C source-cell evidence. Formulas are rejected in all three columns.
 */
export function parseSalesWorkbook(workbook: XLSX.WorkBook): SalesData {
  const sheet = workbook.Sheets.Sales;
  if (!sheet) throw new Error("缺少 Sales 工作表");

  const ref = sheet["!ref"];
  if (!ref || typeof ref !== "string") throw new Error("销售数据至少包含一行");

  let range: XLSX.Range;
  try {
    range = XLSX.utils.decode_range(ref);
  } catch {
    throw new Error("销售数据结构无效");
  }

  const headerCells = EXPECTED_HEADERS.map((_, column) => cellAt(sheet, XLSX.utils.encode_cell({ r: 0, c: column })));
  assertNoFormula(headerCells);
  const headers = headerCells.map((cell) => (cell?.v === undefined || cell?.v === null ? "" : String(cell.v)));
  if (headers.join(",") !== EXPECTED_HEADERS.join(",") || range.e.c >= EXPECTED_HEADERS.length) {
    throw new Error("表头必须依次为 region、previous、current");
  }

  const regions: SalesData["regions"] = [];
  for (let row = 1; row <= range.e.r; row += 1) {
    const rowNumber = row + 1;
    const nameCell = cellAt(sheet, `A${rowNumber}`);
    const previousCell = cellAt(sheet, `B${rowNumber}`);
    const currentCell = cellAt(sheet, `C${rowNumber}`);

    // Tolerate a fully blank interior row, but keep the real row number for
    // every surviving region so the reported source cells stay accurate.
    if (!nameCell && !previousCell && !currentCell) continue;

    assertNoFormula([nameCell, previousCell, currentCell]);

    if (!nameCell || typeof nameCell.v !== "string" || nameCell.v.trim() === "") {
      throw new Error("区域名称必须是非空文本");
    }
    const name = nameCell.v;
    for (const [cell, label] of [
      [previousCell, "上期销售额"],
      [currentCell, "当前销售额"],
    ] as const) {
      if (!cell || cell.t !== "n" || typeof cell.v !== "number" || !Number.isFinite(cell.v) || cell.v < 0) {
        throw new Error(`${name}${label}必须是有限的非负数字`);
      }
    }

    regions.push({
      id: `region-${regions.length + 1}`,
      name,
      previous: previousCell!.v as number,
      current: currentCell!.v as number,
      previousCell: `B${rowNumber}`,
      currentCell: `C${rowNumber}`,
    });

    if (regions.length > MAX_REGIONS) throw new Error("销售数据不能超过 1000 行");
  }

  if (regions.length < 1) throw new Error("销售数据至少包含一行");
  return validateSalesData({ regions });
}

/** Build an export workbook from confirmed data, preserving header and order. */
export function createSalesWorkbook(data: SalesData): XLSX.WorkBook {
  const rows = data.regions.map((region) => [region.name, region.previous, region.current]);
  const sheet = XLSX.utils.aoa_to_sheet([[...EXPECTED_HEADERS], ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sales");
  return book;
}

/** Browser-only entry point: enforce extension and size before parsing. */
export async function readSalesFile(file: File): Promise<SalesData> {
  if (file.size > MAX_FILE_BYTES) throw new Error("文件不能超过 10 MiB");
  // SheetJS reads both formats; the desktop dialog and accept list already
  // advertise .xls, so accepting it here keeps the three routes consistent.
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) throw new Error("只支持 .xlsx 或 .xls 文件");
  // Disable unused parsers (HTML, styles, dates, number formats) to reduce the
  // SheetJS attack surface while keeping cell formulas visible for rejection.
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellFormula: true,
    cellHTML: false,
    cellStyles: false,
    cellDates: false,
    cellNF: false,
  });
  return parseSalesWorkbook(workbook);
}
