import { expect, test } from "@playwright/test";

test("core controls are keyboard reachable and labelled", async ({ page }) => {
  await page.goto("/");

  // Every interactive control has an accessible name.
  const controls = page.locator("button, a[href], input, select");
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const el = controls.nth(i);
    if (await el.getAttribute("aria-hidden") === "true") continue;
    const ariaLabel = await el.getAttribute("aria-label");
    const text = (await el.textContent())?.trim() ?? "";
    const title = await el.getAttribute("title");
    const labelledBy = await el.getAttribute("aria-labelledby");
    // Native controls can also be named by an associated <label for=id>.
    const associatedLabel = await el.evaluate((node) => {
      const id = node.getAttribute("id");
      return id !== null && document.querySelector(`label[for="${id}"]`) !== null;
    });
    expect(ariaLabel !== null || text !== "" || title !== null || labelledBy !== null || associatedLabel).toBe(true);
  }

  // Keyboard flow: focus the editable cell, type, then apply via Enter.
  const east = page.getByLabel("华东当前销售额");
  await east.focus();
  await expect(east).toBeFocused();
  await east.fill("90");
  const apply = page.getByRole("button", { name: "应用修改" });
  await apply.focus();
  await page.keyboard.press("Enter");
  await expect(east).toHaveValue("90");
});

test("dialogs expose accessible roles and focus the safe default", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "清除本地项目" }).click();
  const clear = page.getByRole("dialog", { name: "清除本地项目？" });
  await expect(clear).toBeVisible();
  await expect(clear.getByRole("button", { name: "取消" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(clear).toHaveCount(0);
});
