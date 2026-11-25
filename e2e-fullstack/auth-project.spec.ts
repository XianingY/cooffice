import { expect, test } from "@playwright/test";

test("register, log in and save a project through the real backend", async ({ page }) => {
  await page.goto("/");
  const panel = page.getByRole("heading", { name: "云端同步(可选)" });
  await expect(panel).toBeVisible();

  // Switch to registration and create a unique account.
  await page.getByRole("button", { name: "没有账号?去注册" }).click();
  const email = `e2e-${Date.now()}@test.dev`;
  await page.getByLabel("显示名称").fill("E2E User");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: "注册" }).click();

  await expect(page.getByText(`已登录为 ${email}`)).toBeVisible();

  // Save the current fictional example to the backend.
  await page.getByLabel("项目名称").fill("E2E Smoke Project");
  await page.getByRole("button", { name: "保存到云端" }).click();
  await expect(page.getByText("E2E Smoke Project")).toBeVisible();
  // The SSE subscription is authorised by the same bearer token and confirms
  // the events endpoint accepts the project owner.
  await expect(page.getByText("实时同步已连接")).toBeVisible();

  // Edit a value, then update the cloud project.
  await page.getByLabel("华东当前销售额").fill("90");
  await page.getByRole("button", { name: "更新云端项目" }).click();
  await expect(page.getByText("300 万元 → 270 万元")).toBeVisible();
});

test("API errors are shown as readable messages", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("邮箱").fill("wrong@test.dev");
  await page.getByLabel("密码").fill("wrongpassword");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("alert")).toContainText("邮箱或密码");
});
