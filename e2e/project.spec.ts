import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";

const east = (page: Page) => page.getByLabel("华东当前销售额");
const STORAGE_KEY = "what-if-report:project:v1";

test("import, preview, apply and export the confirmed version", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("input[type=file]", "public/templates/sales-demo.xlsx");
  await expect(page.locator("#sales-file")).toHaveJSProperty("value", "");

  await east(page).fill("90");
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();
  await expect(page.getByText("20.00% → 8.00%")).toBeVisible();
  await expect(page.getByText("华东 → 华西")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("导出已确认版本，不包含未应用草稿");

  await page.getByRole("button", { name: "应用修改" }).click();
  const [excel] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出 Excel" }).click(),
  ]);
  expect(excel.suggestedFilename()).toBe("what-if-report-confirmed.xlsx");

  const [word] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出 Word" }).click(),
  ]);
  expect(word.suggestedFilename()).toBe("what-if-report-confirmed.docx");

  // Both artifacts must carry the same confirmed data (design spec 12).
  const workbook = XLSX.read(readFileSync((await excel.path())!), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Sales, { header: 1 });
  expect(rows[0]).toEqual(["region", "previous", "current"]);
  expect(rows[1]).toEqual(["华东", 100, 90]);

  const entries = unzipSync(new Uint8Array(readFileSync((await word.path())!)));
  const documentXml = strFromU8(entries["word/document.xml"]).replace(/<[^>]+>/g, "");
  expect(documentXml).toContain("当前总销售额为 270 万元。");
  expect(documentXml).toContain("华东：previous=B2，current=C2");
});

test("restore and clear a local draft", async ({ page }) => {
  await page.goto("/");
  await east(page).fill("90");
  await page.reload();
  await expect(east(page)).toHaveValue("90");

  await page.getByRole("button", { name: "清除本地项目" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "取消" })).toBeFocused();
  // The confirmation dialog is fully operable from the keyboard.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "确认清除" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(east(page)).toHaveValue("120");
  // Clearing removes the stored snapshot and does not immediately write it back.
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
});

test("invalid workbook preserves current data", async ({ page }) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["region"]]), "Other");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await page.goto("/");
  await page.setInputFiles("input[type=file]", {
    name: "invalid.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });

  await expect(page.getByRole("alert")).toContainText("缺少 Sales 工作表");
  await expect(east(page)).toHaveValue("120");
  await expect(page.getByLabel("华西当前销售额")).toHaveValue("100");
});

test("mobile layout and keyboard controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await east(page).focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("90");
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();

  await page.getByRole("button", { name: "应用修改" }).focus();
  await page.keyboard.press("Enter");
  await expect(east(page)).toHaveValue("90");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test("editing and exporting never send data to a server", async ({ page }) => {
  await page.goto("/");
  const outbound: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("blob:") || url.startsWith("data:")) return;
    const isLocalAsset = request.method() === "GET" && url.startsWith("http://127.0.0.1:5173");
    if (!isLocalAsset) outbound.push(`${request.method()} ${url}`);
  });

  await east(page).fill("90");
  await page.getByRole("button", { name: "应用修改" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出 Word" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("what-if-report-confirmed.docx");
  expect(outbound).toEqual([]);
});
