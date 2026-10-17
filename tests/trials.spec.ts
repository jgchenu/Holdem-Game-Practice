import { test, expect } from '@playwright/test';

const learned = ['ranks', 'actions', 'position', 'pot-odds', 'draws', 'sizing', 'side-pots', 'value-bluff', 'review'];
test('三境试炼操作、非法加注、分池和独立进度恢复，保持原练习桌', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(ids => {
    if (!localStorage.getItem('wendao:learning:v1')) localStorage.setItem('wendao:learning:v1', JSON.stringify(ids));
  }, learned);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();
  await expect(page.locator('#live-table')).toHaveAttribute('data-busy', 'false');
  const hand = await page.locator('#live-table').getAttribute('aria-label');
  const wallet = await page.locator('#wallet').textContent();
  await page.locator('#study').click();
  await page.locator('[data-trial="free-check"]').click();
  await expect(page.locator('[aria-label="对手底牌未公开"]')).toHaveCount(2);
  await page.locator('#trial-fold').click();
  await expect(page.locator('#trial-feedback')).toContainText('合法行动');
  await expect(page.locator('#trial-feedback')).not.toHaveClass(/passed/);
  await page.locator('#trial-retry').click();
  await page.locator('#trial-call').click();
  await expect(page.locator('#trial-feedback')).toContainText('试炼达成');
  await expect(page.locator('.trial-board .trial-card')).toHaveCount(3);
  await page.locator('#trial-done').click();
  await expect(page.locator('[data-trial="free-check"]')).toContainText('已达成');

  await page.locator('[data-trial="min-raise"]').click();
  await page.locator('#trial-amount').fill('150');
  await page.locator('#trial-raise').click();
  await expect(page.locator('#trial-feedback')).toContainText('至少到 160');
  await expect(page.locator('#trial-call')).toBeEnabled();
  await page.locator('#trial-amount').fill('160');
  await expect(page.locator('#trial-addition')).toHaveText('本次追加 120 灵石');
  await page.screenshot({ path: `artifacts/trial-raise-${info.project.name}.png` });
  await page.locator('#trial-raise').click();
  await expect(page.locator('#trial-feedback')).toContainText('试炼达成');
  await page.locator('#trial-done').click();

  await page.locator('[data-trial="short-call"]').click();
  expect(await page.locator('#study-dialog').evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator('#trial-call')).toHaveText('跟注 80 · 全下');
  await page.locator('#trial-call').click();
  await expect(page.locator('#trial-feedback')).toContainText('你能竞争 300');
  await expect(page.locator('.trial-pots')).toContainText('400');
  await expect(page.locator('[aria-label="摊牌底牌"]')).toHaveCount(2);
  await page.screenshot({ path: `artifacts/trial-pots-${info.project.name}.png` });
  if (info.project.name !== 'desktop') {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.locator('#trial-done').scrollIntoViewIfNeeded();
    const done = await page.locator('#trial-done').boundingBox();
    expect(done!.height).toBeGreaterThanOrEqual(44);
    expect(done!.y + done!.height).toBeLessThanOrEqual(568);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(await page.locator('#study-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    await page.screenshot({ path: `artifacts/trial-short-${info.project.name}.png` });
  }
  await page.locator('#trial-done').click();
  await expect(page.locator('[data-trial="short-call"]')).toBeFocused();
  await expect(page.locator('.trial-progress')).toHaveText('问心试炼 3 / 3');
  await page.getByRole('button', { name: '关闭修炼' }).click();
  await expect(page.locator('#live-table')).toHaveAttribute('aria-label', hand!);
  await expect(page.locator('#wallet')).toHaveText(wallet!);
  await page.reload();
  await expect(page.locator('#resume')).toBeVisible();
  await expect(page.locator('#live-table')).toHaveAttribute('aria-label', hand!);
  await expect(page.locator('#wallet')).toHaveText(wallet!);
  await page.locator('#study').click();
  await expect(page.locator('.trial-progress')).toHaveText('问心试炼 3 / 3');
  await expect(page.locator('[data-trial="short-call"]')).toContainText('已达成');
  expect(errors).toEqual([]);
});
