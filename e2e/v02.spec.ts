import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const east = (page: Page) => page.getByLabel("华东当前销售额");

test("import CSV through guided mapping and preview impacts", async ({ page }) => {
  await page.goto("/");
  await page.setInputFiles("input[type=file]", {
    name: "sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("region,previous,current\n华东,100,120\n华西,90,100\n华北,60,80\n"),
  });

  const dialog = page.getByRole("dialog", { name: "确认列映射" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("区域名称所在列")).toHaveValue("0");
  await dialog.getByRole("button", { name: "确认映射并导入" }).click();
  await expect(dialog).toHaveCount(0);

  await east(page).fill("90");
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();
  await expect(page.getByText("华东 → 华西")).toBeVisible();
});

test("export and re-import a project file preserving draft", async ({ page }) => {
  await page.goto("/");
  await east(page).fill("90");
  await expect(page.getByRole("status")).toContainText("导出已确认版本，不包含未应用草稿");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出项目文件" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("what-if-report-project.json");

  await page.getByRole("button", { name: "清除本地项目" }).click();
  await page.getByRole("button", { name: "确认清除" }).click();
  await expect(east(page)).toHaveValue("120");

  await page.setInputFiles("#project-file", {
    name: "project.json",
    mimeType: "application/json",
    buffer: readFileSync((await download.path())!),
  });
  await expect(east(page)).toHaveValue("90");
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();
});
