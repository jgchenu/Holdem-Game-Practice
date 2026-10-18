import { test, expect, type BrowserContext } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('关闭独立浏览器后，使用同一配置目录恢复牌局、课程和试炼', async ({ playwright, browserName }, info) => {
  test.skip(!['mobile', 'mobile-webkit'].includes(info.project.name), 'Cold-browser persistence is exercised once per engine at a mobile viewport');
  const type = playwright[browserName];
  // Linux WebKit's launcher can use the C locale, which rejects non-ASCII CLI
  // arguments. Keep this disposable profile independent of the Chinese test title.
  const profile = await mkdtemp(join(tmpdir(), 'wendao-browser-profile-'));
  const options = { headless: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' as const };
  let context: BrowserContext | undefined;
  try {
    context = await type.launchPersistentContext(profile, options);
    await context.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      localStorage.setItem('wendao:preferences:v1', '{"sound":false,"reducedMotion":true,"quality":"balanced"}');
      localStorage.setItem('wendao:learning:v1', '["ranks","actions","position"]');
    });
    const first = context.pages()[0] || await context.newPage();
    await first.goto('http://localhost:5173/');
    await expect(first.locator('#start')).toBeEnabled();
    await first.locator('#start').click();
    await expect(first.locator('#live-table')).toHaveAttribute('data-busy', 'false', { timeout: 15_000 });
    await expect(first.locator('#live-table')).toHaveAttribute('data-actor', '0');
    await first.locator('#study').click();
    await first.locator('[data-trial="free-check"]').click();
    await first.locator('#trial-call').click();
    await expect(first.locator('#trial-feedback')).toContainText('试炼达成');
    await first.locator('#trial-done').click();
    await first.getByRole('button', { name: '关闭修炼' }).click();
    const before = await first.evaluate(() => ({
      hand: document.querySelector('#live-table')!.getAttribute('aria-label'),
      wallet: document.querySelector('#wallet')!.textContent,
      courses: document.querySelector('#progress')!.textContent,
    }));
    const originalBrowser = context.browser();
    expect(originalBrowser?.isConnected()).toBe(true);
    await context.close(); // Persistent context close also closes its browser, not only the page.
    expect(originalBrowser?.isConnected()).toBe(false);
    context = await type.launchPersistentContext(profile, options);
    const restored = context.pages()[0] || await context.newPage();
    await restored.goto('http://localhost:5173/');
    await expect(restored.locator('#resume')).toBeEnabled();
    expect(await restored.evaluate(() => ({
      hand: document.querySelector('#live-table')!.getAttribute('aria-label'),
      wallet: document.querySelector('#wallet')!.textContent,
      courses: document.querySelector('#progress')!.textContent,
    }))).toEqual(before);
    await restored.locator('#study').click();
    await expect(restored.locator('[data-trial="free-check"]')).toContainText('已达成');
    await expect(restored.locator('.trial-progress')).toHaveText('问心试炼 1 / 3');
    await restored.screenshot({ path: `artifacts/browser-relaunch-${info.project.name}.png` });
  } finally {
    try { await context?.close(); }
    finally { await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  }
});
