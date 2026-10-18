import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('移动尺寸浏览器持续真实牌局、自然 GC 下的堆和 DOM、浏览器进程组采样',async({page,browser})=>{
  const cycles=Number(process.env.WENDAO_SOAK_CYCLES || 15),output=resolve('artifacts/web-soak');
  mkdirSync(output,{recursive:true});
  const report:any={passed:false,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Dedicated Chromium browser, mobile viewport on this host; not a phone, GPU presentation or leak guarantee',requestedCycles:cycles,rounds:[],pageErrors:[],memoryPolicy:'No forced GC or low-memory simulation. RSS sums may double-count shared pages. CDP process IDs scope OS queries to this browser.'};
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  const browserSession=await browser.newBrowserCDPSession(),targetSession=await page.context().newCDPSession(page);
  await targetSession.send('Performance.enable');
  async function memory(){
    const [processes,dom,performance]=await Promise.all([browserSession.send('SystemInfo.getProcessInfo'),targetSession.send('Memory.getDOMCounters'),targetSession.send('Performance.getMetrics')]);
    const pids=[...new Set<number>(processes.processInfo.map((p:any)=>Number(p.id)))];
    expect(pids.every(p=>Number.isSafeInteger(p)&&p>0)).toBe(true);
    const metrics=Object.fromEntries(performance.metrics.map((m:any)=>[m.name,m.value]));
    let os:any={supported:false};
    if(process.platform==='darwin'||process.platform==='linux'){
      const text=execFileSync('ps',['-o','pid=,rss=','-p',pids.join(',')],{encoding:'utf8',timeout:10_000});
      const rows=text.trim().split('\n').filter(Boolean).map(line=>{const [pid,rss]=line.trim().split(/\s+/).map(Number);return{pid,rssBytes:rss*1024};});
      expect(rows.length).toBeGreaterThan(1);
      os={supported:true,processes:rows,missingPids:pids.filter(pid=>!rows.some(p=>p.pid===pid)),rssBytesSum:rows.reduce((n,p)=>n+p.rssBytes,0)};
    }
    return{at:new Date().toISOString(),dom,jsHeapUsedBytes:metrics.JSHeapUsedSize,jsHeapReservedBytes:metrics.JSHeapTotalSize,processes:processes.processInfo,os};
  }
  const save=()=>writeFileSync(output+'/report.json',JSON.stringify(report,null,2));
  try{
    await page.goto('/');
    await expect(page.locator('#app')).toHaveAttribute('data-boot-phase','ready');
    report.before=await memory();
    let lastStarts=0;
    const started=Date.now();
    for(let cycle=1;cycle<=cycles;cycle++){
      if(await page.locator('#audit-panel').evaluate(e=>(e as HTMLElement).hidden))await page.locator('#audit-open').click();
      await page.locator('#audit-run').click();
      await expect(page.locator('#audit-status')).toHaveAttribute('data-phase','running');
      await page.waitForFunction(()=>['complete','failed'].includes(document.querySelector<HTMLElement>('#audit-status')!.dataset.phase!),null,{timeout:110_000,polling:750});
      const phase=await page.locator('#audit-status').getAttribute('data-phase');
      const measurements=JSON.parse((await page.locator('#audit-report').textContent())!.slice(6));
      report.rounds.push({cycle,phase,measurements,memory:await memory()});report.elapsedMs=Date.now()-started;save();
      expect(phase).toBe('complete');expect(measurements.elapsedMs).toBeGreaterThanOrEqual(65_000);
      expect(measurements.completedHands).toBeGreaterThanOrEqual(2);expect(measurements.frames).toBeGreaterThanOrEqual(1000);
      expect(measurements.starts).toBeGreaterThan(lastStarts);lastStarts=measurements.starts;
      expect(measurements.audioStates).toEqual(['suspended']);expect(report.pageErrors).toEqual([]);
      console.log(`Web soak ${cycle}/${cycles}: ${measurements.completedHands} hands; callback P95 ${measurements.p95Ms}ms; heap ${report.rounds.at(-1).memory.jsHeapUsedBytes}; DOM ${report.rounds.at(-1).memory.dom.nodes}`);
      if(cycle===1||cycle===cycles)await page.screenshot({path:output+`/round-${cycle}.png`});
    }
    report.totalHands=report.rounds.reduce((n:number,r:any)=>n+r.measurements.completedHands,0);report.passed=true;
  }catch(error){report.error=String(error);throw error;}
  finally{save();await targetSession.detach();await browserSession.detach();}
});
