import { test, expect, type Page } from "@playwright/test";

test("首次资源加载失败时能重试进入，字体不可用仍可练习", async ({ page }) => {
  await page.route("**/src/play-ui.ts*", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.locator("#boot-retry")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("本地进度会继续保留");
  await page.unroute("**/src/play-ui.ts*");
  await page.route("**/fonts/wendao-serif.woff2", (route) =>
    route.abort("failed"),
  );
  await page.locator("#boot-retry").click();
  await expect(page.locator("#start")).toBeEnabled();
});

async function idle(page: Page) {
  await expect(page.locator("#live-table")).toHaveAttribute(
    "data-busy",
    "false",
    { timeout: 15_000 },
  );
}
async function start(page: Page, reduced = true) {
  await page.emulateMedia({
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#start").click();
  await idle(page);
  await expect(page.locator("#live-table")).toHaveAttribute("data-actor", "0");
}

test("手机下注面板、重复点击保护与刷新后恢复当前手牌", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page, false);
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (face) =>
          face.family.includes("Wendao Serif") && face.status === "loaded",
      ),
    ),
  ).toBeTruthy();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const controls = await page.locator("#turn-panel").boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await page.screenshot({
    path: `artifacts/play-${info.project.name}.png`,
    fullPage: true,
  });
  if (await page.locator("#raise").isEnabled()) {
    await page.locator("#raise").click();
    await expect(page.locator("#raise-dialog")).toBeVisible();
    const amount = page.locator("#raise-amount");
    const min = Number(await amount.getAttribute("min"));
    await amount.fill("999999");
    await expect(page.locator("#raise-confirm")).toBeDisabled();
    await page.getByRole("button", { name: "最小", exact: true }).click();
    await expect(amount).toHaveValue(String(min));
    await page.getByRole("button", { name: "全下", exact: true }).click();
    await expect(amount).toHaveValue(
      (await amount.getAttribute("max")) as string,
    );
    await page.getByRole("button", { name: "最小", exact: true }).click();
    await page.screenshot({
      path: `artifacts/raise-${info.project.name}.png`,
      fullPage: true,
    });
    await page.locator("#raise-confirm").click();
    await idle(page);
  }
  if (
    (await page.locator("#live-table").getAttribute("data-street")) !==
    "complete"
  ) {
    await page.locator("#pause").click();
    await idle(page);
    await expect(page.locator("#resume")).toBeVisible();
    const before = await page.locator("#live-table").getAttribute("aria-label");
    const wallet = await page.locator("#wallet").textContent();
    await page.reload();
    await idle(page);
    await expect(page.locator("#resume")).toBeVisible();
    await expect(page.locator("#live-table")).toHaveAttribute(
      "aria-label",
      before!,
    );
    await expect(page.locator("#wallet")).toHaveText(wallet!);
    await page.locator("#resume").click();
    await idle(page);
  }
  expect(errors).toEqual([]);
});

test("真实牌局可以连续完成、查看公开行动复盘并开始下一手", async ({ page }) => {
  await start(page);
  let turns = 0;
  while (
    (await page.locator("#live-table").getAttribute("data-street")) !==
    "complete"
  ) {
    expect(++turns).toBeLessThan(35);
    await expect(page.locator("#call")).toBeEnabled();
    // Synchronous duplicate clicks must not spend chips for a later turn.
    await page.evaluate(() => {
      const b = document.querySelector("#call") as HTMLButtonElement;
      b.click();
      b.click();
      b.click();
    });
    await idle(page);
  }
  const raw = await page.evaluate(
    () => JSON.parse(localStorage.getItem("wendao:practice:v1")!).hand,
  );
  expect(
    raw.players.reduce((sum: number, p: { stack: number }) => sum + p.stack, 0),
  ).toBe(
    raw.players.reduce(
      (sum: number, p: { startingStack: number }) => sum + p.startingStack,
      0,
    ),
  );
  await page.locator("#review").click();
  await expect(page.locator("#review-dialog")).toContainText("回顾行动");
  await expect(page.locator(".action-history li")).not.toHaveCount(0);
  await page.getByRole("button", { name: "关闭复盘" }).click();
  await page.locator("#next").click();
  await idle(page);
  await expect(page.locator("#hand-number")).toHaveText("第 2 手");
  await expect(page.locator("#about")).toBeVisible();
  await page.addInitScript((value) => {
    delete value.result.hands;
    localStorage.setItem(
      "wendao:practice:v1",
      JSON.stringify({ version: 1, hand: value }),
    );
  }, raw);
  await page.reload();
  await expect(page.locator("#start")).toBeVisible();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#save-status")).toContainText("旧记录无法读取");
});

test("三项修炼、答错重试、进度保存与短屏操作区可见", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#study").click();
  await expect(page.locator('[data-lesson="3"]')).toBeDisabled();
  await expect(page.locator('[data-lesson="6"]')).toBeDisabled();
  for (const [index, answers] of [
    [0, [1, 2]],
    [1, [0, 1]],
    [2, [2, 1]],
  ] as const) {
    await page.locator(`[data-lesson="${index}"]`).click();
    if (index === 0) {
      await page.locator('[data-answer="0"]').click();
      await expect(page.locator("#quiz-feedback")).toContainText("再想一想");
    }
    for (const answer of answers) {
      await page.locator(`[data-answer="${answer}"]`).click();
      await expect(page.locator("#quiz-feedback")).toContainText("答对了");
      await page.locator("#quiz-next").click();
    }
  }
  await expect(page.locator("#study-dialog")).toContainText("筑基 · 入门");
  await page.getByRole("button", { name: "关闭修炼" }).click();
  await expect(page.locator("#progress")).toHaveText("3/9");
  await page.reload();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#progress")).toHaveText("3/9");
  await page.setViewportSize({ width: 320, height: 568 });
  const startButton = await page.locator("#start").boundingBox();
  expect(startButton!.height).toBeGreaterThanOrEqual(44);
  expect(startButton!.y + startButton!.height).toBeLessThanOrEqual(568);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("九课逐境解锁，进阶练习和满境进度可恢复", async ({ page }, info) => {
  test.setTimeout(120_000);
  test.skip(
    !["mobile", "mobile-webkit"].includes(info.project.name),
    "Progression exercised on both mobile browser engines",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled();
  await page.locator("#study").click();
  const answers = [
    [1, 2],
    [0, 1],
    [2, 1],
    [0, 1],
    [1, 1],
    [1, 1],
    [1, 1],
    [0, 1],
    [1, 1],
  ];
  for (let index = 0; index < answers.length; index++) {
    await expect(page.locator(`[data-lesson="${index}"]`)).toBeEnabled();
    await page.locator(`[data-lesson="${index}"]`).click();
    for (const answer of answers[index]) {
      await page.locator(`[data-answer="${answer}"]`).click();
      await expect(page.locator("#quiz-feedback")).toContainText("答对了");
      await page.locator("#quiz-next").click();
    }
    if (index < 5)
      await expect(page.locator('[data-lesson="6"]')).toBeDisabled();
  }
  await expect(page.locator(".realm-progress")).toContainText("金丹 · 圆满");
  await page.screenshot({
    path: `artifacts/learning-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "关闭修炼", exact: true }).click();
  await page.reload();
  await expect(page.locator("#progress")).toHaveText("9/9");
  await page.locator("#study").click();
  await expect(page.locator('[data-lesson="8"]')).toBeEnabled();
  await expect(page.locator(".realm-progress")).toContainText("金丹 · 圆满");
});

test("师父面板显示规则事实，模型文本安全呈现，失败回退不改变牌局", async ({
  page,
}, info) => {
  await start(page);
  const before = await page.locator("#live-table").getAttribute("aria-label");
  const wallet = await page.locator("#wallet").textContent();
  let captured: any;
  await page.route("**/api/coach", async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({
      json: {
        source: "model",
        text: "<img src=x onerror=alert(1)>先看公开行动，再衡量价格。",
      },
    });
  });
  await page.getByRole("button", { name: "请教青玄师父" }).click();
  await expect(page.locator("#coach-dialog")).toBeVisible();
  await expect(page.locator("#coach-source")).toHaveText("规则计算 · 本地");
  await page.getByRole("button", { name: "看懂局面", exact: true }).click();
  await expect(page.locator("#coach-source")).toContainText("AI 解读");
  await expect(page.locator("#coach-reply")).toContainText("<img src=x");
  await expect(page.locator("#coach-reply img")).toHaveCount(0);
  expect(captured.snapshot.heroCards).toHaveLength(2);
  expect(captured.snapshot.deck).toBeUndefined();
  expect(captured.snapshot.players.some((p: any) => "hole" in p)).toBeFalsy();
  await page.unroute("**/api/coach");
  await page.route("**/api/coach", (route) =>
    route.fulfill({ status: 503, json: { error: "not-configured" } }),
  );
  await page.getByRole("button", { name: "衡量价格", exact: true }).click();
  await expect(page.locator("#coach-source")).toContainText("本地指引");
  await expect(page.locator("#coach-reply")).toContainText("不是实际胜率");
  await page.screenshot({
    path: `artifacts/mentor-local-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "关闭师父", exact: true }).click();
  await expect(page.locator("#resume")).toBeVisible();
  await expect(page.locator("#live-table")).toHaveAttribute(
    "aria-label",
    before!,
  );
  await expect(page.locator("#wallet")).toHaveText(wallet!);
});
