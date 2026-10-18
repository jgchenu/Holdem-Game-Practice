import { setDiagnosticText } from './diagnostic-text';

/** Native UI test build only: observe first-touch delivery without retrying it. */
export function initializeStartupTrace() {
  const events: object[] = [], errors: string[] = [], history: object[] = [];
  const snapshot = () => ({ atMs: Math.round(performance.now()), timeOriginMs: performance.timeOrigin, phase: document.getElementById('app')?.dataset.bootPhase, detail: document.getElementById('app')?.dataset.bootDetail, inert: document.getElementById('app')?.inert, readyState: document.readyState, focused: document.hasFocus(), hidden: document.hidden, open: [...document.querySelectorAll('dialog[open]')].map(d => d.id), viewport: { width:innerWidth,height:innerHeight,top:visualViewport?.offsetTop,scale:visualViewport?.scale } });
  const record = (value: object) => { events.push(value); if (events.length>60) events.shift(); };
  for (const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','click','close']) document.addEventListener(type, event => {
    const e = event as MouseEvent, target = event.target as HTMLElement;
    if(type==='pointermove' && (event as PointerEvent).pointerType!=='touch' && !e.buttons)return;
    const touch=(event as TouchEvent).changedTouches?.[0];
    record({ type, trusted:event.isTrusted, eventTimestampMs:event.timeStamp, target:target.id || target.tagName, connected:target.isConnected, button:target.closest('button')?.id, x:touch?.clientX??e.clientX, y:touch?.clientY??e.clientY, ...snapshot() });
    queueMicrotask(()=>{ if(type==='click') record({type:'after-click',...snapshot()}); render(); });
  },true);
  const error = (message: string) => { errors.push(message.slice(0,500)); if(errors.length>10)errors.shift(); render(); };
  window.addEventListener('error', e => error(e.message));
  window.addEventListener('unhandledrejection', e => error(String(e.reason)));
  const host=document.createElement('aside');host.id='startup-trace';
  host.style.cssText='position:fixed;left:4px;top:175px;z-index:9999;max-width:92vw;font:10px monospace;background:#163126;color:#d8c58b;border:1px solid #a99a6755';
  host.innerHTML='<button id="startup-trace-open" style="min-height:36px;background:transparent;color:inherit">启动诊断</button><span id="startup-state" style="display:block;max-width:90vw;max-height:30px;overflow:hidden"></span><div id="startup-trace-panel" hidden><button id="startup-trace-close">收起诊断</button><pre id="startup-trace-report" style="white-space:pre-wrap;overflow:auto;max-height:260px;max-width:90vw;overflow-wrap:anywhere"></pre></div>';
  document.body.append(host);
  const panel=host.querySelector<HTMLDivElement>('#startup-trace-panel')!, output=host.querySelector<HTMLElement>('#startup-trace-report')!, stateNode=host.querySelector<HTMLElement>('#startup-state')!;
  let signature='';
  function render(){
    const current=snapshot();
    const state={phase:current.phase,inert:current.inert,detail:current.detail,hidden:current.hidden,focused:current.focused,errors};
    const next=JSON.stringify(state);
    if(next!==signature){
      signature=next;
      history.push({atMs:current.atMs,stage:current.phase,detail:current.detail,inert:current.inert,hidden:current.hidden,focused:current.focused});
      if(history.length>20)history.shift();
      record({type:'boot-state',...current});
      // XCTest polls only the two real readiness facts. Keep the full history
      // out of this always-visible AX label until diagnostics are requested.
      setDiagnosticText(stateNode,'BOOTSTATE '+JSON.stringify({phase:state.phase,inert:state.inert}));
    }
    if(panel.hidden)return;
    const button=document.getElementById('learn-start'), r=button?.getBoundingClientRect(), styles=button?getComputedStyle(button):null;
    setDiagnosticText(output,'STARTUP '+JSON.stringify({events,errors,history,current,inputCapabilities:{hover:matchMedia('(hover: hover)').matches,finePointer:matchMedia('(pointer: fine)').matches,touchPoints:navigator.maxTouchPoints},entry:r?{x:r.x,y:r.y,width:r.width,height:r.height,touchAction:styles?.touchAction,filter:styles?.filter,transform:styles?.transform}:null}));
  }
  host.querySelector('#startup-trace-open')!.addEventListener('click',()=>{panel.hidden=false;render();});
  host.querySelector('#startup-trace-close')!.addEventListener('click',()=>{panel.hidden=true;});
  const root=document.getElementById('app');
  if(root)new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-boot-phase','data-boot-detail','inert']});
  window.addEventListener('focus',render);window.addEventListener('blur',render);
  document.addEventListener('visibilitychange',()=>{record({type:'visibilitychange',...snapshot()});render();});
  // Event-driven updates preserve AX text nodes instead of replacing them
  // every 500 ms while XCTest is trying to resolve the startup marker.
  render();
}
