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

test('试炼离线可操作，完成印记断网重载后保留', async ({ page, context }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('wendao:learning:v1')) localStorage.setItem('wendao:learning:v1', '["ranks","actions","position"]');
  });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#study').click();
  await page.locator('[data-trial="free-check"]').click();
  await page.locator('#trial-call').click();
  await expect(page.locator('#trial-feedback')).toContainText('试炼达成');
  await page.locator('#trial-done').click();
  await expect(page.locator('.trial-progress')).toHaveText('问心试炼 1 / 3');
  await page.reload();
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#study').click();
  await expect(page.locator('[data-trial="free-check"]')).toContainText('已达成');
  await expect(page.locator('.trial-progress')).toHaveText('问心试炼 1 / 3');
  await context.setOffline(false);
});

test('零基础带练可以离线进入，断网刷新后继续上次教学步骤', async ({page,context})=>{
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await page.locator('#learn-start').click();
  await page.locator('#tutorial-next').click();
  await expect(page.locator('#tutorial-step-title')).toHaveText('先认识你的两张底牌');
  await page.reload();
  await page.locator('#tutorial-open').click();
  await expect(page.locator('#tutorial-step-title')).toHaveText('先认识你的两张底牌');
  await page.locator('#tutorial-hole').click();
  await expect(page.locator('#tutorial-step-title')).toHaveText('牌上的字和图案怎么看');
  await context.setOffline(false);
});
