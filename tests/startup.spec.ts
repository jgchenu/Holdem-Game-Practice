import { test, expect } from '@playwright/test';

test('渲染器启动出错后提供可操作的重试，重试后教学正常进入', async ({page}) => {
  let injected = false;
  await page.route('**/src/live-scene.ts', async route => {
    const response = await route.fetch(), body = await response.text();
    expect(body).toContain('createTextures(this);');
    // Keep routing on reload: WebKit can cache a fulfilled response when the
    // route is removed, which would inject the same fault into the retry.
    const result = injected ? body : body.replace('createTextures(this);', 'throw new Error("Injected scene preparation failure");');
    injected = true;
    await route.fulfill({response,body:result});
  });
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','failed');
  await expect(page.locator('#app')).toHaveJSProperty('inert',false);
  await expect(page.getByRole('alert')).toContainText('暂时未能铺开牌席');
  await page.locator('#boot-retry').click();
  await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  await page.locator('#learn-start').click();
  await expect(page.getByRole('button',{name:'关闭新手教学'})).toBeVisible();
});

test('牌桌异步准备完成前保持启动保护，完成后教学可用', async ({ page }) => {
  // Delay only the real renderer's ready notification, after it has created the scene.
  // This checks the asynchronous boundary; it is not a native startup benchmark.
  await page.route('**/src/live-scene.ts', async route => {
    const response = await route.fetch(), body = await response.text();
    expect(body).toContain('this.hooks.ready();');
    await route.fulfill({ response, body: body.replace('this.hooks.ready();', 'window.__releaseTableReady = () => this.hooks.ready();') });
  });
  await page.route('**/src/native.ts', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'export async function initializePlatform(){return ()=>{}};export async function dismissLaunchScreen(){window.__splashRequested=true}',
  }));
  await page.goto('/');
  await page.waitForFunction(() => typeof (window as any).__releaseTableReady === 'function');
  await expect(page.locator('#app')).toHaveJSProperty('inert', true);
  // The native overlay must be released so an occluded WebView can render,
  // while the DOM stays inert until the real table is ready.
  expect(await page.evaluate(() => Boolean((window as any).__splashRequested))).toBe(true);
  await page.evaluate(() => (window as any).__releaseTableReady());
  await expect(page.locator('#app')).toHaveJSProperty('inert', false);
  await page.getByRole('button', { name: '从零学德州 →', exact: true }).click();
  await expect(page.getByRole('button', { name: '师父带我学第一手 →', exact: true })).toBeVisible();
});

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

test('原生交接失败释放真实牌桌，网络状态变化不破坏重试，教学进度保留', async ({page}) => {
  await page.goto('/');
  await page.locator('#learn-start').click();
  await page.locator('#tutorial-next').click();
  await page.getByRole('button',{name:'关闭新手教学'}).click();
  const progress = await page.evaluate(() => localStorage.getItem('wendao:onboarding:v1'));
  const errors: string[] = [];
  page.on('pageerror',error => errors.push(error.message));
  await page.route('**/src/live-scene.ts', async route => {
    const response = await route.fetch(), body = await response.text();
    expect(body).toContain('this.hooks.ready();');
    expect(body).toContain('() => this.feedback.dispose()');
    await route.fulfill({response, body: body
      .replace('this.hooks.ready();','window.__sceneCreated = true; this.hooks.ready();')
      .replace('() => this.feedback.dispose()','() => { this.feedback.dispose(); window.__sceneDestroyed = true; }')});
  });
  let failNextLaunch = true;
  await page.route('**/src/native.ts', route => {
    const fail = failNextLaunch; failNextLaunch = false;
    return route.fulfill({contentType:'text/javascript',body:`
      export async function initializePlatform(){ return () => {}; }
      let failed = false;
      export async function dismissLaunchScreen(){
        if (${fail} && !failed) {
          while (!window.__sceneCreated) await new Promise(resolve => setTimeout(resolve, 20));
          failed = true; throw new Error('Injected native handover failure');
        }
      }`});
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('暂时未能铺开牌席');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__sceneDestroyed))).toBe(true);
  // Controlled lifecycle notifications avoid Vite's automatic reconnect reload.
  // This injects a browser bridge failure; it is not a native iOS runtime result.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('wendao:suspend'));
    window.dispatchEvent(new Event('wendao:storage-error'));
  });
  await expect(page.locator('#app')).toHaveJSProperty('inert',false);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('wendao:onboarding:v1'))).toBe(progress);
  await page.locator('#boot-retry').click();
  await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  await page.locator('#learn-start').click();
  await expect(page.locator('#tutorial-step-title')).toHaveText('先认识你的两张底牌');
  await expect(page.locator('#wallet')).toHaveText('1,000');
});
