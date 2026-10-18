/** Native UI test build only: record first-touch delivery without retrying the action. */
export function initializeStartupTrace() {
  const events: object[] = [], errors: string[] = [];
  const snapshot = () => ({ atMs: Math.round(performance.now()), inert: document.getElementById('app')?.inert, readyState: document.readyState, focused: document.hasFocus(), open: [...document.querySelectorAll('dialog[open]')].map(d => d.id), viewport: { width:innerWidth,height:innerHeight,top:visualViewport?.offsetTop,scale:visualViewport?.scale } });
  const record = (value: object) => { events.push(value); if (events.length>60) events.shift(); };
  for (const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','click','close']) document.addEventListener(type, event => {
    const e = event as MouseEvent, target = event.target as HTMLElement;
    record({ type, target:target.id || target.tagName, connected:target.isConnected, button:target.closest('button')?.id, x:e.clientX, y:e.clientY, ...snapshot() });
    if(type==='click') queueMicrotask(()=>record({type:'after-click',...snapshot()}));
  },true);
  window.addEventListener('error', e => { errors.push(e.message); });
  window.addEventListener('unhandledrejection', e => { errors.push(String(e.reason)); });
  const host=document.createElement('aside');host.id='startup-trace';
  host.style.cssText='position:fixed;left:4px;top:175px;z-index:9999;max-width:92vw;font:10px monospace;background:#163126;color:#d8c58b;border:1px solid #a99a6755';
  host.innerHTML='<button id="startup-trace-open" style="min-height:36px;background:transparent;color:inherit">启动诊断</button><div id="startup-trace-panel" hidden><button id="startup-trace-close">收起诊断</button><pre id="startup-trace-report" style="white-space:pre-wrap;overflow:auto;max-height:260px;max-width:90vw;overflow-wrap:anywhere"></pre></div>';
  document.body.append(host);
  const panel=host.querySelector<HTMLDivElement>('#startup-trace-panel')!, output=host.querySelector<HTMLElement>('#startup-trace-report')!;
  const render=()=>{
    if(panel.hidden)return;
    const button=document.getElementById('learn-start'), r=button?.getBoundingClientRect();
    output.textContent='STARTUP '+JSON.stringify({events,errors,current:snapshot(),entry:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null});
  };
  host.querySelector('#startup-trace-open')!.addEventListener('click',()=>{panel.hidden=false;render();});
  host.querySelector('#startup-trace-close')!.addEventListener('click',()=>{panel.hidden=true;});
  setInterval(render,500);
}
