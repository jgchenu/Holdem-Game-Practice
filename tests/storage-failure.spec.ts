import { test, expect } from '@playwright/test';

test('模拟桌面存储不可用时可临时练习，后续写入不会误报已保存', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.assign(window, { __TAURI_INTERNALS__: { invoke: () => Promise.reject(new Error('Test storage is unavailable')) } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#save-status')).toContainText('暂时无法保存');
  await page.locator('#start').click();
  await expect(page.locator('#live-table')).toHaveAttribute('data-busy', 'false', { timeout: 15_000 });
  await expect(page.locator('#live-table')).toHaveAttribute('data-actor', '0');
  await expect(page.locator('#save-status')).toContainText('暂时无法保存');
  await expect(page.locator('#save-status')).not.toContainText('本地保存');
  await page.locator('#settings').click();
  await page.locator('#quality').selectOption('balanced');
  await expect(page.locator('#settings-feedback')).toContainText('暂时无法保存偏好');
  await page.getByRole('button', { name: '关闭设置' }).click();
  await page.screenshot({ path: `artifacts/storage-failure-${info.project.name}.png` });
});
