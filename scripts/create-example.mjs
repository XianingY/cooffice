import { mkdirSync } from "node:fs";
import * as XLSX from "xlsx";

// Fictional sample only. Never commit real business or personal data.
const rows = [
  ["region", "previous", "current"],
  ["华东", 100, 120],
  ["华西", 90, 100],
  ["华北", 60, 80],
];

const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Sales");

mkdirSync("public/templates", { recursive: true });
XLSX.writeFile(book, "public/templates/sales-demo.xlsx");
XLSX.writeFile(book, "public/templates/sales-template.xlsx");
