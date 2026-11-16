import { expect, test } from "@playwright/test";

test("report config survives reload through the unified v3 storage", async ({ page }) => {
  await page.goto("/");
  const config = page.getByRole("group", { name: "报告块配置" });
  await config.getByRole("checkbox", { name: "显示同比增长率" }).uncheck();
  await expect(page.getByRole("region", { name: "草稿报告" })).not.toContainText("同比增长率为");

  await page.reload();
  await expect(page.getByRole("region", { name: "草稿报告" })).not.toContainText("同比增长率为");
  await expect(config.getByRole("checkbox", { name: "显示同比增长率" })).not.toBeChecked();

  const stored = await page.evaluate(() => localStorage.getItem("what-if-report:project:v1"));
  expect(stored).toContain('"schemaVersion":3');
  expect(stored).toContain('"format":"what-if-report-project"');
});

test("legacy v1 snapshots migrate on load without losing data", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const legacy = {
      schemaVersion: 1,
      baseline: {
        regions: [
          { id: "region-1", name: "华南", previous: 50, current: 70, previousCell: "B2", currentCell: "C2" },
        ],
      },
      draft: {
        regions: [
          { id: "region-1", name: "华南", previous: 50, current: 70, previousCell: "B2", currentCell: "C2" },
        ],
      },
      updatedAt: "2026-11-16T00:00:00.000Z",
    };
    localStorage.setItem("what-if-report:project:v1", JSON.stringify(legacy));
  });
  await page.reload();

  await expect(page.getByLabel("华南当前销售额")).toHaveValue("70");
  await expect(page.getByRole("region", { name: "草稿报告" })).toContainText("当前总销售额为 70 万元。");
});
