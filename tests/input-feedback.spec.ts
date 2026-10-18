import {test,expect} from '@playwright/test';

test('触屏不保留鼠标悬停滤镜，桌面保留高亮，首次操作仍打开教学',async({page},info)=>{
  await page.goto('/');
  await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  const entry=page.locator('#learn-start');
  await entry.hover();
  await expect(entry).toHaveCSS('filter',info.project.use.hasTouch?'none':'brightness(1.08)');
  if(info.project.use.hasTouch)await entry.tap();else await entry.click();
  await expect(page.locator('#tutorial-dialog')).toBeVisible();
  await page.getByRole('button',{name:'关闭新手教学'}).click();
  await page.addScriptTag({type:'module',content:"import {initializeStartupTrace} from '/src/startup-trace.ts';initializeStartupTrace();"});
  await page.locator('#startup-trace-open').click();
  const trace=JSON.parse((await page.locator('#startup-trace-report').textContent())!.slice(8));
  expect(trace.inputCapabilities.hover).toBe(!info.project.use.hasTouch);
  expect(trace.inputCapabilities.finePointer).toBe(!info.project.use.hasTouch);
  expect(trace.entry.touchAction).toBe('none');
  if(info.project.use.hasTouch)expect(trace.entry.filter).toBe('none');
});
