import test from 'node:test';
import assert from 'node:assert/strict';
import { startCoachFixture, fixtureLabel } from '../../scripts/coach-fixture.mjs';
import { act, createHand, observe } from '../../src/core/poker';
import { coachSnapshot } from '../../src/coach-contract';

test('原生 HTTP 验收替身使用真实网关，覆盖 CORS、成功、上游错误、超时与连接释放', async () => {
  const fixture = await startCoachFixture({timeoutMs:150});
  try {
    let hand = createHand({names:['你','甲','乙']});
    while(hand.actor !== 0) hand = act(hand,hand.actor!,{type:'call'});
    const body = JSON.stringify({topic:'price',snapshot:coachSnapshot(observe(hand,0))});
    const origin = 'http://tauri.localhost';
    const options = await fetch(fixture.url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
    assert.equal(options.status,204); assert.equal(options.headers.get('access-control-allow-origin'),origin);
    for(const [mode,status] of [['success',200],['error',502],['timeout',504]] as const){
      fixture.setNextMode(mode);
      const response = await fetch(fixture.url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body});
      assert.equal(response.status,status);
      const text = await response.text();
      assert.equal(text.includes('fixture-server-only'),false);
      if(mode==='success') assert.ok(JSON.parse(text).text.startsWith(fixtureLabel));
    }
    const denied=await fetch(fixture.url,{headers:{Origin:'https://untrusted.invalid'}});assert.equal(denied.status,403);
    const report=fixture.report();assert.deepEqual(report.upstreamRequests.map(r=>r.mode),['success','error','timeout']);
    assert.ok(report.upstreamRequests.every(r=>r.playersHaveNoPrivateCards&&r.serverCredentialPresent));
    assert.deepEqual(report.gatewayRequests.filter(r=>r.method==='POST').map(r=>r.status),[200,502,504]);
    const end=Date.now()+1000;
    while(!fixture.report().upstreamRequests.at(-1)?.disconnected && Date.now()<end) await new Promise(r=>setTimeout(r,10));
    assert.equal(fixture.report().upstreamRequests.at(-1)?.disconnected,true,'The real gateway timeout must release its upstream connection');
  } finally { await fixture.close(); }
});
