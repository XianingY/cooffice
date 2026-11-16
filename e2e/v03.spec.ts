import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("report config persists in the project file and chart reflects edits", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "各区域当前销售额" })).toBeVisible();
  await expect(page.getByRole("img", { name: /各区域当前销售额/ })).toContainText("华东");

  const config = page.getByRole("group", { name: "报告块配置" });
  await config.getByRole("checkbox", { name: "显示同比增长率" }).uncheck();
  const preview = page.getByRole("region", { name: "草稿报告" });
  await expect(preview).not.toContainText("同比增长率为");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "导出项目文件" }).click(),
  ]);
  const document = JSON.parse(readFileSync((await download.path())!, "utf-8"));
  expect(document.schemaVersion).toBe(3);
  expect(document.config.blocks).not.toContain("growthNarrative");

  // Restore via the project file, which is where report config is persisted
  // in v0.3.0 (localStorage unification is part of v1.0.0).
  await page.getByRole("button", { name: "清除本地项目" }).click();
  await page.getByRole("button", { name: "确认清除" }).click();
  await expect(page.getByRole("region", { name: "草稿报告" })).toContainText("同比增长率为");

  await page.setInputFiles("#project-file", {
    name: "project.json",
    mimeType: "application/json",
    buffer: readFileSync((await download.path())!),
  });
  await expect(page.getByRole("region", { name: "草稿报告" })).not.toContainText("同比增长率为");
});
