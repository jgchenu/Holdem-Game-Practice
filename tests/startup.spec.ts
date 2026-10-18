import { test, expect } from '@playwright/test';

test('模拟原生启动图收起期间不接收点击，收起后第一次点击即可打开教学', async ({ page }, info) => {
  // Hold only the native transition bridge; the actual page and guide run as-is.
  // This is a browser integration check, not a real iOS launch timing result.
  await page.route('**/src/native.ts', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export async function initializePlatform(){ return () => {}; }
      export async function dismissLaunchScreen(){
        await new Promise(resolve => { window.__finishNativeSplash = resolve; });
      }`,
  }));
  await page.goto('/');
  await expect(page.locator('#learn-start')).toBeVisible();
  await expect(page.locator('#app')).toHaveJSProperty('inert', true);
  const blocked = await page.locator('#learn-start').click({ timeout: 250 }).then(() => false, () => true);
  expect(blocked).toBe(true);
  await expect(page.locator('#tutorial-dialog')).not.toBeVisible();
  await page.evaluate(() => (window as Window & { __finishNativeSplash: () => void }).__finishNativeSplash());
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
  await page.screenshot({ path: `artifacts/startup-entry-${info.project.name}.png` });
  await page.getByRole('button', { name: '从零学德州 →', exact: true }).click();
  await expect(page.getByRole('button', { name: '师父带我学第一手 →', exact: true })).toBeVisible();
});
