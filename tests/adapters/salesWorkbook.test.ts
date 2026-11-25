import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { salesDemo } from "../../src/fixtures/salesDemo";
import {
  createSalesWorkbook,
  parseSalesWorkbook,
  readSalesFile,
} from "../../src/adapters/xlsx/salesWorkbook";

const sheetOf = (book: XLSX.WorkBook): XLSX.WorkSheet => book.Sheets.Sales!;

const bookFromRows = (rows: unknown[][]): XLSX.WorkBook => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Sales");
  return book;
};

const roundTrip = () => parseSalesWorkbook(createSalesWorkbook(salesDemo));

describe("sales workbook", () => {
  it("round-trips valid data and source cells", () => {
    expect(roundTrip()).toEqual(salesDemo);
  });

  it("creates a Sales sheet with exact headers and preserved region order", () => {
    const book = createSalesWorkbook(salesDemo);
    expect(book.SheetNames).toEqual(["Sales"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheetOf(book), { header: 1 });
    expect(rows).toEqual([
      ["region", "previous", "current"],
      ["华东", 100, 120],
      ["华西", 90, 100],
      ["华北", 60, 80],
    ]);
  });

  it("rejects a missing Sales worksheet", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["region"]]), "Other");
    expect(() => parseSalesWorkbook(book)).toThrow("缺少 Sales 工作表");
  });

  it("rejects wrong, reordered or extra headers", () => {
    expect(() => parseSalesWorkbook(bookFromRows([["region", "current", "previous"], ["华东", 100, 120]]))).toThrow("表头");
    expect(() => parseSalesWorkbook(bookFromRows([["Region", "previous", "current"], ["华东", 100, 120]]))).toThrow("表头");
    expect(() => parseSalesWorkbook(bookFromRows([["region", "previous", "current", "extra"], ["华东", 100, 120, "x"]]))).toThrow("表头");
  });

  it("rejects a header-only workbook", () => {
    expect(() => parseSalesWorkbook(bookFromRows([["region", "previous", "current"]]))).toThrow("至少包含一行");
  });

  it("rejects formulas in any of the three columns", () => {
    for (const column of ["A", "B", "C"] as const) {
      const book = createSalesWorkbook(salesDemo);
      sheetOf(book)[`${column}2`].f = "100+20";
      expect(() => parseSalesWorkbook(book)).toThrow("不能包含公式");
    }
  });

  it("rejects duplicate regions", () => {
    const book = createSalesWorkbook(salesDemo);
    sheetOf(book).A3.v = "华东";
    expect(() => parseSalesWorkbook(book)).toThrow("区域名称不能重复");
  });

  it("rejects text numbers", () => {
    const book = createSalesWorkbook(salesDemo);
    sheetOf(book).C2 = { t: "s", v: "120" } as XLSX.CellObject;
    expect(() => parseSalesWorkbook(book)).toThrow("非负数字");
  });

  it("rejects blank values, negative numbers and booleans", () => {
    const blank = createSalesWorkbook(salesDemo);
    delete sheetOf(blank).C2;
    expect(() => parseSalesWorkbook(blank)).toThrow("非负数字");

    const negative = createSalesWorkbook(salesDemo);
    sheetOf(negative).C2.v = -5;
    expect(() => parseSalesWorkbook(negative)).toThrow("非负数字");

    const boolean = createSalesWorkbook(salesDemo);
    sheetOf(boolean).C2 = { t: "b", v: true } as XLSX.CellObject;
    expect(() => parseSalesWorkbook(boolean)).toThrow("非负数字");
  });

  it("rejects more than 1000 data rows", () => {
    const rows: unknown[][] = [["region", "previous", "current"]];
    for (let index = 1; index <= 1001; index += 1) {
      rows.push([`区域${index}`, 1, 2]);
    }
    expect(() => parseSalesWorkbook(bookFromRows(rows))).toThrow("不能超过 1000 行");
  });

  it("keeps real spreadsheet row addresses when a blank row is skipped", () => {
    const book = bookFromRows([
      ["region", "previous", "current"],
      ["华东", 100, 120],
      [],
      ["华西", 90, 100],
      ["华北", 60, 80],
    ]);
    const parsed = parseSalesWorkbook(book);
    expect(parsed.regions.map((region) => [region.name, region.previousCell, region.currentCell])).toEqual([
      ["华东", "B2", "C2"],
      ["华西", "B4", "C4"],
      ["华北", "B5", "C5"],
    ]);
  });
});

describe("readSalesFile", () => {
  const buffer = XLSX.write(createSalesWorkbook(salesDemo), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const fakeFile = (name: string, size: number) =>
    ({ name, size, arrayBuffer: async () => buffer }) as unknown as File;

  it("accepts the legacy .xls extension that the desktop dialog advertises", async () => {
    expect(await readSalesFile(fakeFile("sales.xls", buffer.byteLength))).toEqual(salesDemo);
  });

  it("rejects unsupported extensions", async () => {
    await expect(readSalesFile(fakeFile("sales.csv", 100))).rejects.toThrow("只支持 .xlsx 或 .xls 文件");
  });

  it("rejects files larger than 10 MiB", async () => {
    await expect(readSalesFile(fakeFile("sales.xlsx", 10 * 1024 * 1024 + 1))).rejects.toThrow("文件不能超过 10 MiB");
  });

  it("reads a valid workbook", async () => {
    expect(await readSalesFile(fakeFile("sales.xlsx", buffer.byteLength))).toEqual(salesDemo);
  });
});
