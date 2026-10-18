import {test,expect} from '@playwright/test';

test('启动诊断状态不变时不反复替换可访问性文本节点',async({page})=>{
  await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  // Load the actual optional monitor; the ordinary game has no trace overlay.
  await page.addScriptTag({type:'module',content:"import {initializeStartupTrace} from '/src/startup-trace.ts'; initializeStartupTrace();"});
  await expect(page.locator('#startup-state')).toHaveText('BOOTSTATE {"phase":"ready","inert":false}');
  const observation=await page.evaluateHandle(()=>{
    const element=document.querySelector('#startup-state')!;
    const state={text:element.textContent,redundantReplacements:0};
    const observer=new MutationObserver(()=>{const next=element.textContent;if(next===state.text)state.redundantReplacements++;state.text=next;});
    observer.observe(element,{childList:true,characterData:true,subtree:true});return{state,observer};
  });
  await page.waitForTimeout(1200); // More than two old polling intervals.
  const redundant=await observation.evaluate(value=>{value.observer.disconnect();return value.state.redundantReplacements;});
  await observation.dispose();expect(redundant).toBe(0);
});

test('简短启动标记保留真实阶段与输入锁定，完整历史只在展开后呈现',async({page})=>{
  await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  await page.addScriptTag({type:'module',content:"import {initializeStartupTrace} from '/src/startup-trace.ts'; initializeStartupTrace();"});
  const marker=page.locator('#startup-state'), report=page.locator('#startup-trace-report');
  await expect(marker).toHaveText('BOOTSTATE {"phase":"ready","inert":false}');
  await expect(report).toHaveText('');
  await page.evaluate(()=>{const root=document.querySelector<HTMLElement>('#app')!;root.inert=true;root.dataset.bootPhase='renderer';});
  await expect(marker).toHaveText('BOOTSTATE {"phase":"renderer","inert":true}');
  await page.evaluate(()=>{document.querySelector<HTMLElement>('#app')!.dataset.bootPhase='ready';});
  await expect(marker).toHaveText('BOOTSTATE {"phase":"ready","inert":true}');
  await page.evaluate(()=>{document.querySelector<HTMLElement>('#app')!.inert=false;});
  await expect(marker).toHaveText('BOOTSTATE {"phase":"ready","inert":false}');
  await page.getByRole('button',{name:'启动诊断',exact:true}).click();
  const full=JSON.parse((await report.textContent())!.slice(8));
  expect(full.history).toEqual(expect.arrayContaining([expect.objectContaining({stage:'renderer',inert:true}),expect.objectContaining({stage:'ready',inert:true}),expect.objectContaining({stage:'ready',inert:false})]));
  expect(full.current.timeOriginMs).toBeGreaterThan(0);
  expect(full.current.phase).toBe('ready');expect(full.current.inert).toBe(false);
});

test('原生审计返回的历史音频快照不随后续真实 AudioContext 状态变化而改变',async({page})=>{
  await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  await page.addScriptTag({type:'module',content:"import {initializeNativeAudit} from '/src/native-audit.ts'; await initializeNativeAudit();"});
  await page.waitForFunction(()=>Boolean((window as any).__wendaoAudit));
  const snapshot=await page.evaluateHandle(()=>(window as any).__wendaoAudit.report());
  expect(await snapshot.evaluate(report=>report.audioEvents.length)).toBe(0);
  await page.locator('#sound').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__wendaoAudit.report().audioStates)).toEqual(['running']);
  await expect.poll(()=>page.evaluate(()=>(window as any).__wendaoAudit.report().audioEvents.length)).toBeGreaterThan(0);
  await page.locator('#sound').click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__wendaoAudit.report().audioStates)).toEqual(['suspended']);
  const oldLength=await snapshot.evaluate(report=>report.audioEvents.length);await snapshot.dispose();
  expect(oldLength,'A past snapshot must not gain future events').toBe(0);
});

test('画布诊断读取实际渲染器缓冲区，不改变当前手牌与灵石',async({page},testInfo)=>{
  await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  await page.locator('#learn-start').click();await page.getByRole('button',{name:'关闭新手教学',exact:true}).click();
  await page.locator('#start').click();
  await page.waitForFunction(()=>{const table=document.querySelector<HTMLElement>('#live-table')!;return table.dataset.busy==='false'&&(table.dataset.actor==='0'||table.dataset.street==='complete');});
  const before={hand:await page.locator('#live-table').getAttribute('aria-label'),wallet:await page.locator('#wallet').textContent()};
  await page.addScriptTag({type:'module',content:"import {initializeNativeAudit} from '/src/native-audit.ts'; await initializeNativeAudit();"});
  await page.getByRole('button',{name:'运行验收',exact:true}).click();
  await page.getByRole('button',{name:'检查画布渲染',exact:true}).click();
  const state=page.locator('#audit-render-state');await expect(state).toContainText('DRAWSTATE ');
  const facts=JSON.parse((await state.textContent())!.slice('DRAWSTATE '.length));
  expect(facts.error).toBeUndefined();expect(facts.width).toBe(840);expect(facts.height).toBe(1000);
  expect(facts.nonTransparent).toBeGreaterThan(100);expect(facts.lightCardPixels).toBeGreaterThan(100);
  expect(facts.cssWidth).toBeGreaterThan(0);expect(facts.cssHeight).toBeGreaterThan(0);
  expect(facts.contextLost).toBe(false);expect(facts.hidden).toBe(false);expect(facts.frame).toBeGreaterThan(0);
  await expect(page.getByAltText('验收渲染器读取图，非屏幕画面')).toBeVisible();
  expect({hand:await page.locator('#live-table').getAttribute('aria-label'),wallet:await page.locator('#wallet').textContent()}).toEqual(before);
  await page.getByAltText('验收渲染器读取图，非屏幕画面').scrollIntoViewIfNeeded();
  await page.screenshot({path:`artifacts/renderer-probe-${testInfo.project.name}.png`});
  const originalStyle=await page.locator('#live-table canvas').getAttribute('style');
  await page.getByRole('button',{name:'收起验收',exact:true}).click();
  await expect(page.locator('#audit-panel')).toBeHidden();
  await page.screenshot({path:`artifacts/composite-baseline-${testInfo.project.name}.png`});
  for(const [variant,title] of [['isolation','对照隔离层'],['layer','对照独立层'],['outside','对照外置画布'],['restore','恢复画布布局']]){
    await page.getByRole('button',{name:'运行验收',exact:true}).click();
    await page.getByRole('button',{name:title,exact:true}).click();
    await expect(page.locator('#audit-composite-state')).toContainText(`COMPOSITE {"variant":"${variant}"`);
    const canvas=page.locator('canvas').first();
    expect(await canvas.evaluate(el=>el.parentElement?.id==='live-table')).toBe(variant!=='outside');
    expect({hand:await page.locator('#live-table').getAttribute('aria-label'),wallet:await page.locator('#wallet').textContent()}).toEqual(before);
    await page.getByRole('button',{name:'收起验收',exact:true}).click();
    await expect(page.locator('#audit-panel')).toBeHidden();
    await page.screenshot({path:`artifacts/composite-${variant}-${testInfo.project.name}.png`});
  }
  expect(await page.locator('#live-table canvas').getAttribute('style')).toBe(originalStyle);
});
