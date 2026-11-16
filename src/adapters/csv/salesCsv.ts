import type { TabularInput } from "../../core/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Small RFC 4180-style parser: quoted fields, escaped quotes and CRLF. */
function parseRows(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") pushField();
    else if (char === "\n") pushRow();
    else if (char === "\r") {
      if (source[index + 1] !== "\n") pushRow();
    } else field += char;
  }

  if (quoted) throw new Error("CSV 引号未闭合，请检查文件后重试");
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

/** Parse CSV text into a source-agnostic table; mapping is confirmed in the UI. */
export function parseCsv(text: string): TabularInput {
  const rows = parseRows(text);
  if (rows.length === 0 || rows[0].every((cell) => cell.trim() === "")) {
    throw new Error("CSV 缺少表头，首行应为列名");
  }
  return { headers: rows[0], rows: rows.slice(1), source: "csv" };
}

/** Browser-only CSV entry point with extension and size guards. */
export async function readCsvFile(file: File): Promise<TabularInput> {
  if (file.size > MAX_FILE_BYTES) throw new Error("文件不能超过 10 MiB");
  if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("只支持 .csv 文件");
  return parseCsv(await file.text());
}
