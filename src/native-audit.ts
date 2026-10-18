import { flushStorage, writeStorage } from './storage';
import { setDiagnosticText } from './diagnostic-text';

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
      audioEvents: audioEvents.map(event => ({ ...event })), quality: 'fine', reducedMotion: false,
      renderEnvironment: renderEnvironment(),
    };
  }
  const overlay = document.createElement('aside');
  overlay.id = 'native-audit';
  overlay.style.cssText = 'position:fixed;top:max(160px,calc(env(safe-area-inset-top) + 110px));left:4px;z-index:9999;max-width:94vw;background:#13291f;color:#ddc893;border:1px solid #c4b17c;padding:4px;font:11px/1.4 monospace';
  overlay.innerHTML = '<button id="audit-open" style="background:#203c2c;color:inherit;min-height:40px">运行验收</button><div id="audit-panel" style="max-height:55dvh;overflow:auto" hidden><button id="audit-reset">重置采样</button><button id="audit-hide">收起验收</button><button id="audit-run">连续牌局验收</button><button id="audit-stop" hidden>停止验收</button><button id="audit-render-probe">检查画布渲染</button><button data-audit-composite="isolation">对照隔离层</button><button data-audit-composite="layer">对照独立层</button><button data-audit-composite="outside">对照外置画布</button><button data-audit-composite="restore">恢复画布布局</button><pre id="audit-composite-state" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><p>仅验收构建 · 非 GPU 帧率</p><p id="audit-status" role="status" data-phase="idle">尚未运行连续验收</p><pre id="audit-summary" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><pre id="audit-render-state" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><p>渲染器缓冲区读取图（不是原生屏幕截图）</p><img id="audit-render-image" alt="验收渲染器读取图，非屏幕画面" hidden style="width:150px;height:auto"><pre id="audit-report" style="max-height:240px;max-width:88vw;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere"></pre></div>';
  document.body.append(overlay);
  const panel = overlay.querySelector<HTMLDivElement>('#audit-panel')!, output = overlay.querySelector<HTMLElement>('#audit-report')!;
  const status = overlay.querySelector<HTMLElement>('#audit-status')!, summary = overlay.querySelector<HTMLElement>('#audit-summary')!;
  const runButton = overlay.querySelector<HTMLButtonElement>('#audit-run')!, stopButton = overlay.querySelector<HTMLButtonElement>('#audit-stop')!, resetButton = overlay.querySelector<HTMLButtonElement>('#audit-reset')!;
  overlay.querySelectorAll('button').forEach(button => { button.style.cssText += ';background:#203c2c;color:inherit;min-height:40px;padding:6px;border:1px solid #c4b17c55'; });
  let frozen: ReturnType<typeof report> | undefined, running = false, cancelled = false;
  const reset = () => { frozen = undefined; samples.length = 0; hands.clear(); previous = 0; started = performance.now(); };
  const render = () => {
    if (panel.hidden) return;
    const r = frozen ?? report();
    setDiagnosticText(output, 'AUDIT ' + JSON.stringify(r));
    setDiagnosticText(summary, 'MEASURE ' + JSON.stringify({ elapsedMs:r.elapsedMs,frames:r.frames,busyFrames:r.busyFrames,p50Ms:r.p50Ms,p95Ms:r.p95Ms,p99Ms:r.p99Ms,maxMs:r.maxMs,busyP95Ms:r.busyP95Ms,gapsOver50Ms:r.gapsOver50Ms,completedHands:r.completedHands,audioStates:r.audioStates,starts:r.starts,stops:r.stops,hidden:r.hidden,suspends:r.suspends,quality:r.quality,reducedMotion:r.reducedMotion,renderer:r.renderEnvironment.renderer }));
  };
  overlay.querySelector('#audit-open')!.addEventListener('click', () => { panel.hidden = false; render(); });
  overlay.querySelector('#audit-hide')!.addEventListener('click', () => { panel.hidden = true; });
  resetButton.addEventListener('click', () => { reset(); render(); });
  stopButton.addEventListener('click', () => { cancelled = true; });
  runButton.addEventListener('click', async () => {
    if (running) return;
    running = true; cancelled = false; runButton.disabled = resetButton.disabled = true; stopButton.hidden = false;
    status.dataset.phase = 'running'; status.textContent = '正在运行 65 秒真实牌局验收';
    // Called synchronously inside the trusted audit-button gesture, so real
    // Web Audio must unlock normally. Never substitute its browser objects.
    const sound = document.getElementById('sound') as HTMLButtonElement;
    if (sound.getAttribute('aria-pressed') === 'true') sound.click();
    sound.click();
    panel.hidden = true;
    const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
    const enabled = (id: string) => { const button = document.getElementById(id) as HTMLButtonElement; if (!button.hidden && !button.disabled) button.click(); };
    try {
      reset();
      const end = performance.now() + 65_000;
      while (performance.now() < end) {
        if (cancelled || document.hidden) throw new Error('验收被停止或进入后台，本轮未完成');
        const table = document.getElementById('live-table')!;
        if (table.dataset.busy !== 'true') {
          if (table.dataset.street === 'complete') enabled('next');
          else if (!document.getElementById('resume')!.hidden) enabled('resume');
          else if (table.dataset.street === 'ready') enabled('start');
          else if (table.dataset.actor === '0') enabled('call');
        }
        await wait(180);
      }
      if (document.getElementById('pause')?.textContent === '暂停') enabled('pause');
      if (sound.getAttribute('aria-pressed') === 'true') sound.click();
      const settle = performance.now() + 15_000;
      while ((document.getElementById('live-table')?.dataset.busy === 'true' || contexts.some(c => c.state === 'running')) && performance.now() < settle) await wait(80);
      frozen = report();
      if (frozen.frames < 1000 || frozen.busyFrames < 30 || frozen.completedHands < 2 || !frozen.starts || frozen.audioStates.some(s => s !== 'suspended')) throw new Error('本轮未满足完整牌局、采样或实际音频检查，请查看报告');
      status.dataset.phase = 'complete'; status.textContent = '连续验收完成；帧时间是否达标请单独看数据';
    } catch (error) {
      frozen = report(); status.dataset.phase = 'failed'; status.textContent = String(error);
    } finally {
      if (sound.getAttribute('aria-pressed') === 'true') sound.click();
      running = false; runButton.disabled = resetButton.disabled = false; stopButton.hidden = true; panel.hidden = false; render();
    }
  });
  setInterval(render, 500);
  Object.assign(window, { __wendaoAudit: { report, reset } });
}
