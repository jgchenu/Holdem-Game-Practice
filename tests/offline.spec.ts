import { test, expect } from "@playwright/test";

test("生产版断网冷加载、继续牌局与离线课程", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBeTruthy();
  await page.locator("#start").click();
  await expect(page.locator("#live-table")).toHaveAttribute(
    "data-busy",
    "false",
  );
  const before = await page.locator("#live-table").getAttribute("aria-label");
  const wallet = await page.locator("#wallet").textContent();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#resume")).toBeEnabled();
  await expect(page.locator("#live-table")).toHaveAttribute(
    "aria-label",
    before!,
  );
  await expect(page.locator("#wallet")).toHaveText(wallet!);
  await page.locator("#resume").click();
  await expect(page.locator("#call")).toBeEnabled();
  await page.locator("#study").click();
  await page.locator('[data-lesson="0"]').click();
  await page.locator('[data-answer="1"]').click();
  await expect(page.locator("#quiz-feedback")).toContainText("答对了");
  const paths = await page.evaluate(async () => {
    const key = (await caches.keys()).find((key) =>
      key.startsWith("wendao-shell-"),
    )!;
    return (await (await caches.open(key)).keys()).map(
      (request) => new URL(request.url).pathname,
    );
  });
  expect(paths).toContain("/index.html");
  expect(paths.some((path) => path.includes("/api/"))).toBeFalsy();
  await context.setOffline(false);
});
