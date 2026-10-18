import { test, expect } from "@playwright/test";

test("完整体验：防止重复推进、翻牌、抬牌、结算和重新开始", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?mode=demo");
  const advance = page.locator("#advance");
  await expect(advance).toBeEnabled();
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-ready.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    const button = document.getElementById("advance") as HTMLButtonElement;
    button.click();
    button.click();
    button.click();
  });
  await expect(advance).toHaveText("观翻牌");
  await expect(page.locator("#stage-label")).toHaveText("起手 · 藏锋");
  await page.locator("#inspect").click();
  await page.locator("#inspect").click();
  for (const text of ["观转牌", "观河牌", "演示结算"]) {
    await advance.click();
    await expect(advance).toHaveText(text);
    await expect(advance).toBeEnabled();
  }
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-river.png`,
    fullPage: true,
  });
  await advance.click();
  await expect(advance).toHaveText("再修一局");
  await expect(page.locator("#inspect")).toBeDisabled();
  await advance.click();
  await expect(advance).toHaveText("入席试炼");
  await expect(page.locator("#reset")).toBeDisabled();
  await advance.click();
  await expect(advance).toHaveText("观翻牌");
  await page.locator("#reset").click();
  await expect(advance).toHaveText("入席试炼");
  expect(errors).toEqual([]);
});

test("设置保存、减少动态效果和说明弹窗可用", async ({ page }) => {
  await page.goto("/?mode=demo");
  await expect(page.locator("#advance")).toBeEnabled();
  await page.getByRole("button", { name: "体验设置" }).click();
  await page.locator("#motion-toggle").check();
  await page.locator("#sound-toggle").check();
  await page.locator("#quality").selectOption("balanced");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.reload();
  await expect(page.locator("#advance")).toBeEnabled();
  await expect(page.locator("html")).toHaveClass("reduced-motion");
  await expect(page.getByRole("button", { name: "关闭音效" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "体验设置" }).click();
  await expect(page.locator("#quality")).toHaveValue("balanced");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "体验设置" })).toBeFocused();
  for (const label of ["观翻牌", "观转牌", "观河牌", "演示结算", "再修一局"]) {
    await page.locator("#advance").click();
    await expect(page.locator("#advance")).toHaveText(label);
  }
  await page.locator("#about").click();
  await expect(page.locator("#about-dialog")).toContainText("没有真实下注");
  await page.getByRole("button", { name: "关闭说明" }).click();
});

test("系统减少动态效果偏好生效，窄屏无横向溢出", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mode=demo");
  await expect(page.locator("#advance")).toBeEnabled();
  await expect(page.locator("html")).toHaveClass("reduced-motion");
  await page.getByRole("button", { name: "体验设置" }).click();
  await expect(page.locator("#motion-toggle")).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
