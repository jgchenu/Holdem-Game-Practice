import Phaser from "phaser";
import { TableScene } from "./scene";
import { readPreferences, savePreferences, stages } from "./demo";
import "./style.css";

const icons = {
  sound:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2.5" fill="#152923"/><circle cx="16" cy="17" r="2.5" fill="#152923"/></svg>',
  reset:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 9a8 8 0 1 1-1 6M5 4v5h5"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 12h15m-5-5 5 5-5 5"/></svg>',
};

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="landscape" aria-hidden="true">
    <svg class="mountains" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="mountain" x2="0" y2="1"><stop stop-color="#3c5c4f" stop-opacity=".2"/><stop offset="1" stop-color="#10251f" stop-opacity=".05"/></linearGradient></defs><circle cx="1060" cy="220" r="87" fill="#d9c796" opacity=".035"/><path d="M0 600 130 390 210 470 350 180 430 310 510 260 690 610 770 530 950 280 1090 430 1170 340 1440 650V900H0Z" fill="url(#mountain)"/><path d="m0 760 160-230 110 110 160-280 150 140 110-50 180 180 150-180 150 120 170-180 150 210v300H0Z" fill="#1b382e" opacity=".3"/><path d="m0 810 220-100 180 80 160-140 190 100 190-70 180 100 320-120v240H0Z" fill="#0d211b" opacity=".5"/></svg>
  </div>
  <div class="layout">
    <aside class="intro" aria-label="游戏介绍">
      <div class="seal large">问道</div>
      <p class="eyebrow">THE PATH WITHIN</p>
      <h1>方寸之间<br/>自有乾坤</h1>
      <div class="gold-line"></div>
      <p class="intro-copy">从一手牌，走向一场修行。<br/>在云隐山中，静心，观势，悟道。</p>
      <div class="edition"><span>壹</span><div>云隐试炼<small>移动端动效样板 · 0.1</small></div></div>
    </aside>
    <main class="game-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="问道牌途首页"><span class="seal">道</span><span>问道牌途<small>WENDAO POKER</small></span></a>
        <div class="header-actions"><button class="icon-button" id="sound" aria-label="开启音效" aria-pressed="false">${icons.sound}<span class="mute-line"></span></button><button class="icon-button" id="settings" aria-label="体验设置">${icons.settings}</button></div>
      </header>
      <section class="chapter" aria-label="试炼进度"><div><span class="chapter-mark">壹</span><span>云隐山<small>初入仙门</small></span></div><span class="sample-tag">动效试炼</span></section>
      <section class="table-wrap" aria-label="六人牌桌固定演示">
        <div class="stage-line"><span></span><p id="stage-label">静心 · 入席</p><span></span></div>
        <div id="table" role="img" aria-label="云隐山六人牌桌，尚未发牌"></div>
        <div id="loading" role="status">正在铺开牌席…</div>
      </section>
      <section class="interaction">
        <div class="mentor"><div class="mentor-emblem" aria-hidden="true">玄</div><div class="mentor-body"><div class="mentor-heading"><span>青玄师父</span><span class="mentor-badge">预设指引</span></div><p id="tip" aria-live="polite">先静下心。轻触「入席试炼」，感受你的第一手牌。</p></div></div>
        <div class="action-row"><button id="reset" class="reset-button" aria-label="重置演示" disabled>${icons.reset}</button><button id="advance" class="primary-button" disabled><span id="action-text">准备牌席</span>${icons.arrow}</button><button id="inspect" class="inspect-button" disabled>观牌</button></div>
        <div class="steps" aria-label="演示步骤">${["入席", "起手", "翻牌", "转牌", "河牌", "终局"].map((s, i) => `<span class="step ${i === 0 ? "current" : ""}" data-step="${i}"><i></i>${s}</span>`).join("")}</div>
        <button class="demo-note" id="about">固定牌局演示 · 不代表真实对战 <span>ⓘ</span></button>
      </section>
    </main>
    <aside class="side-note">
      <span class="vertical-title">落子有声 · 行牌有意</span>
      <div class="note-bottom"><span class="tiny-diamond">◇</span><p>墨青为席，暖金为引。<br/>让每一次出手，都从容有度。</p><button id="about-desktop">关于本次体验 ${icons.arrow}</button></div>
    </aside>
  </div>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-header"><div><p class="eyebrow">MAKE IT YOURS</p><h2 id="settings-title">调息 · 体验设置</h2></div><button class="close-button" aria-label="关闭设置">×</button></div>
    <label class="setting-row"><span>音效<small>轻柔的翻牌与灵石提示音</small></span><input id="sound-toggle" type="checkbox" role="switch"/></label>
    <label class="setting-row"><span>减少动态效果<small>缩短位移与翻转，关闭灵气粒子</small></span><input id="motion-toggle" type="checkbox" role="switch"/></label>
    <label class="setting-row"><span>灵气效果<small>均衡模式减少装饰粒子</small></span><select id="quality"><option value="fine">细腻</option><option value="balanced">均衡</option></select></label>
    <div class="metrics"><span>当前浏览器帧间隔采样</span><strong id="fps">等待有效样本</strong><small id="frame-time">这是当前浏览器的循环采样，不等于手机真机或 GPU 性能测试。</small></div>
    <p id="settings-feedback" class="dialog-footnote">偏好保存在本设备。样板尚未经过手机安装包实测。</p>
  </dialog>
  <dialog id="about-dialog" aria-labelledby="about-title"><div class="dialog-header"><div><p class="eyebrow">A FIRST GLIMPSE</p><h2 id="about-title">方寸之间的第一步</h2></div><button class="close-button" aria-label="关闭说明">×</button></div><p class="about-copy">这是《问道牌途》的可交互动效样板。你可以逐步体验发牌、抬牌、公共牌翻转与灵石结算，也可以在设置中调整音效和动态效果。</p><div class="about-callout">牌局、筹码与师父指引均为预设演示。当前没有真实下注、随机对战、修为奖励或大模型连接。</div><p class="about-copy">接下来将接入独立规则核心，再逐步加入新手试炼、进阶修炼与 AI 师父。</p></dialog>
`;

const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const preferences = readPreferences();
const advance = get<HTMLButtonElement>("advance");
const reset = get<HTMLButtonElement>("reset");
const inspect = get<HTMLButtonElement>("inspect");
const sound = get<HTMLButtonElement>("sound");
const soundToggle = get<HTMLInputElement>("sound-toggle");
const motionToggle = get<HTMLInputElement>("motion-toggle");
const quality = get<HTMLSelectElement>("quality");
let currentStage = 0;
let busy = true;
let dialogOpener: HTMLElement | null = null;

const scene = new TableScene(preferences, {
  state(stage, isBusy) {
    currentStage = stage;
    busy = isBusy;
    advance.disabled = isBusy;
    reset.disabled = isBusy || stage === 0;
    inspect.disabled = isBusy || stage === 0 || stage === 5;
    get("action-text").textContent = isBusy ? "观局中…" : stages[stage].action;
    get("stage-label").textContent = stages[stage].label;
    get("tip").textContent = stages[stage].tip;
    get("table").setAttribute(
      "aria-label",
      `固定演示牌局：${stages[stage].label}。${stages[stage].tip}`,
    );
    document.querySelectorAll<HTMLElement>(".step").forEach((el, index) => {
      el.classList.toggle("current", index === stage);
      el.classList.toggle("done", index < stage);
      if (index === stage) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
  },
  metrics(fps, p95) {
    get("fps").textContent =
      `${Math.round(fps)} FPS · P95 ${p95.toFixed(1)} ms`;
  },
  ready() {
    get("loading").remove();
  },
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "table",
  width: 840,
  height: 1100,
  transparent: true,
  antialias: true,
  powerPreference: "low-power",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 60, forceSetTimeOut: false },
  scene,
});

async function runAdvance() {
  try {
    await scene.advance();
  } catch (error) {
    get("tip").textContent = "本次动效未能完成，请刷新页面重新体验。";
    console.error("Demo animation failed", error);
  }
}
advance.addEventListener("click", () => void runAdvance());
reset.addEventListener("click", () => scene.reset());
inspect.addEventListener("click", () => scene.liftHand());
document.querySelector(".brand")!.addEventListener("click", (event) => {
  event.preventDefault();
  if (!busy) scene.reset();
});

function syncPreferences() {
  sound.setAttribute("aria-pressed", String(preferences.sound));
  sound.setAttribute("aria-label", preferences.sound ? "关闭音效" : "开启音效");
  sound.classList.toggle("is-muted", !preferences.sound);
  soundToggle.checked = preferences.sound;
  motionToggle.checked = preferences.reducedMotion;
  quality.value = preferences.quality;
  document.documentElement.classList.toggle(
    "reduced-motion",
    preferences.reducedMotion,
  );
  scene.applyPreferences();
}
function persistPreferences() {
  syncPreferences();
  get("settings-feedback").textContent = savePreferences(preferences)
    ? "偏好保存在本设备。样板尚未经过手机安装包实测。"
    : "当前浏览器无法保存偏好，设置仅在本次体验中生效。";
}
sound.addEventListener("click", () => {
  preferences.sound = !preferences.sound;
  persistPreferences();
  scene.feedback.unlock();
  scene.feedback.play("card");
});
soundToggle.addEventListener("change", () => {
  preferences.sound = soundToggle.checked;
  persistPreferences();
  scene.feedback.unlock();
});
motionToggle.addEventListener("change", () => {
  preferences.reducedMotion = motionToggle.checked;
  persistPreferences();
});
quality.addEventListener("change", () => {
  preferences.quality = quality.value === "balanced" ? "balanced" : "fine";
  persistPreferences();
});
syncPreferences();

function openDialog(id: string, opener: HTMLElement) {
  dialogOpener = opener;
  get<HTMLDialogElement>(id).showModal();
}
get("settings").addEventListener("click", (event) =>
  openDialog("settings-dialog", event.currentTarget as HTMLElement),
);
["about", "about-desktop"].forEach((id) =>
  get(id).addEventListener("click", (event) =>
    openDialog("about-dialog", event.currentTarget as HTMLElement),
  ),
);
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog
    .querySelector(".close-button")!
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => dialogOpener?.focus());
});

document.addEventListener("keydown", (event) => {
  if (
    document.querySelector("dialog[open]") ||
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLButtonElement
  )
    return;
  if (event.code === "Space") {
    event.preventDefault();
    if (!busy) void runAdvance();
  }
  if (event.key.toLowerCase() === "h" && currentStage > 0 && !busy)
    scene.liftHand();
});

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
