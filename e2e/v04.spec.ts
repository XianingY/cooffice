import { expect, test } from "@playwright/test";

test("AI polish is opt-in and never sends data without confirmation", async ({ page }) => {
  const outbound: string[] = [];
  await page.goto("/");
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("blob:") || url.startsWith("data:")) return;
    if (!(request.method() === "GET" && url.startsWith("http://127.0.0.1:5173"))) {
      outbound.push(`${request.method()} ${url}`);
    }
  });

  await page.getByLabel("华东当前销售额").fill("90");
  await page.getByRole("button", { name: "应用修改" }).click();

  // Opening settings alone must not trigger any request.
  await page.getByRole("button", { name: "AI 润色设置" }).click();
  const dialog = page.getByRole("dialog", { name: "AI 润色设置" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("运行时密钥")).toHaveAttribute("type", "password");
  expect(outbound).toEqual([]);

  // Leaving all fields empty uses the deterministic template (no network).
  await dialog.getByRole("button", { name: "润色已确认报告" }).click();
  await expect(page.getByRole("region", { name: "AI 润色结果" })).toContainText("270 万元");
  expect(outbound).toEqual([]);
});
