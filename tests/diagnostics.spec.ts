import {test,expect} from '@playwright/test';

test('启动诊断状态不变时不反复替换可访问性文本节点',async({page})=>{
  await page.goto('/');await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
  // Load the actual optional monitor; the ordinary game has no trace overlay.
  await page.addScriptTag({type:'module',content:"import {initializeStartupTrace} from '/src/startup-trace.ts'; initializeStartupTrace();"});
  await expect(page.locator('#startup-state')).toContainText('"phase":"ready"');
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
