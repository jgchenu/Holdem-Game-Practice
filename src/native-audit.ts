import { flushStorage, writeStorage } from './storage';

/** Opt-in native audit builds only. Observes actual browser resources, never substitutes them. */
export async function initializeNativeAudit() {
  writeStorage('wendao:preferences:v1', JSON.stringify({ sound: false, reducedMotion: false, quality: 'fine' }));
  await flushStorage();
  const contexts: AudioContext[] = [];
  const audioEvents: { atMs: number; state: string }[] = [];
  let starts = 0, stops = 0, hidden = 0, suspends = 0;
  const NativeContext = window.AudioContext;
  class ObservedContext extends NativeContext {
    constructor(options?: AudioContextOptions) {
      super(options); contexts.push(this);
      this.addEventListener('statechange', () => { audioEvents.push({ atMs: Math.round(performance.now()), state: this.state }); if (audioEvents.length > 100) audioEvents.shift(); });
    }
    override createOscillator() {
      const voice = super.createOscillator(), start = voice.start.bind(voice), stop = voice.stop.bind(voice);
      voice.start = when => { starts++; start(when); };
      voice.stop = when => { stops++; stop(when); };
      return voice;
    }
  }
  window.AudioContext = ObservedContext;
  const samples: { ms: number; busy: boolean }[] = [], hands = new Set<string>();
  let started = performance.now(), previous = 0;
  document.addEventListener('visibilitychange', () => { previous = 0; if (document.hidden) hidden++; });
  window.addEventListener('wendao:suspend', () => { suspends++; });
  function frame(now: number) {
    if (!document.hidden) {
      const table = document.getElementById('live-table');
      if (previous && samples.length < 18_000) samples.push({ ms: now - previous, busy: table?.dataset.busy === 'true' });
      previous = now;
      if (table?.dataset.street === 'complete') hands.add(document.getElementById('hand-number')?.textContent || '');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const percentile = (values: number[], fraction: number) => values.length ? Math.round([...values].sort((a,b) => a-b)[Math.min(values.length-1, Math.ceil(values.length*fraction)-1)] * 100) / 100 : null;
  function renderEnvironment() {
    const canvas = document.querySelector<HTMLCanvasElement>('#live-table canvas');
    // Inspect the renderer already created by Phaser; never create a new canvas or context.
    const gl = canvas?.getContext('webgl') || canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      devicePixelRatio, viewport: [innerWidth, innerHeight], hardwareConcurrency: navigator.hardwareConcurrency,
      canvas: canvas ? [canvas.width, canvas.height] : null,
      renderer: gl ? String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)) : 'not WebGL',
    };
  }
  function report() {
    const values = samples.map(s => s.ms), busy = samples.filter(s => s.busy).map(s => s.ms);
    return {
      scope: 'native WebView JS frame cadence; not GPU presentation or phone performance',
      elapsedMs: Math.round(performance.now()-started), frames: samples.length, busyFrames: busy.length,
      p50Ms: percentile(values,.5), p95Ms: percentile(values,.95), p99Ms: percentile(values,.99),
      maxMs: values.length ? Math.round(Math.max(...values)*100)/100 : null,
      busyP95Ms: percentile(busy,.95), gapsOver50Ms: values.filter(v=>v>50).length,
      completedHands: hands.size, audioStates: contexts.map(c=>c.state), starts, stops, hidden, suspends,
      audioEvents, quality: 'fine', reducedMotion: false,
      renderEnvironment: renderEnvironment(),
    };
  }
  const overlay = document.createElement('aside');
  overlay.id = 'native-audit';
  overlay.style.cssText = 'position:fixed;top:max(160px,calc(env(safe-area-inset-top) + 110px));left:4px;z-index:9999;max-width:94vw;background:#13291f;color:#ddc893;border:1px solid #c4b17c;padding:4px;font:11px/1.4 monospace';
  overlay.innerHTML = '<button id="audit-open" style="background:#203c2c;color:inherit;min-height:40px">运行验收</button><div id="audit-panel" hidden><button id="audit-reset">重置采样</button><button id="audit-hide">收起验收</button><p>仅验收构建 · 非 GPU 帧率</p><pre id="audit-report" style="max-height:240px;max-width:88vw;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere"></pre></div>';
  document.body.append(overlay);
  const panel = overlay.querySelector<HTMLDivElement>('#audit-panel')!, output = overlay.querySelector<HTMLElement>('#audit-report')!;
  const render = () => { if (!panel.hidden) output.textContent = 'AUDIT ' + JSON.stringify(report()); };
  overlay.querySelector('#audit-open')!.addEventListener('click', () => { panel.hidden = false; render(); });
  overlay.querySelector('#audit-hide')!.addEventListener('click', () => { panel.hidden = true; });
  overlay.querySelector('#audit-reset')!.addEventListener('click', () => { samples.length = 0; hands.clear(); previous = 0; started = performance.now(); render(); });
  setInterval(render, 500);
  Object.assign(window, { __wendaoAudit: { report, reset: () => { samples.length = 0; hands.clear(); previous = 0; started = performance.now(); } } });
}
