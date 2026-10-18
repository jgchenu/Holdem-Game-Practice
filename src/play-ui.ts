import Phaser from "phaser";
import { LiveScene } from "./live-scene";
import { readPreferences, savePreferences } from "./preferences";
import {
  act,
  observe,
  legalActions,
  streetNames,
  type Action,
} from "./core/poker";
import { cardText } from "./core/cards";
import { chooseAction } from "./core/bot";
import { loadSession, saveSession, nextHand } from "./session";
import {
  lessons,
  learningStages,
  learningRealm,
  isLessonUnlocked,
  loadLearning,
  saveLearning,
  isTrialUnlocked,
  loadTrials,
  saveTrials,
} from "./learning";
import { trials } from "./trials";
import { openTrialPanel } from "./trial-panel";
import { openOnboarding, onboardingComplete } from "./onboarding-panel";
import { guidance } from "./coach";
import { createMentorPanel } from "./mentor-panel";
import "./play.css";
import { flushStorage, storageHealthy } from "./storage";

const icons = {
  sound:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m11 5-5 4H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2.5"/><circle cx="16" cy="17" r="2.5"/></svg>',
};
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="landscape" aria-hidden="true"><svg class="mountains" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice"><path d="M0 700 180 410 290 520 450 200 610 480 750 410 930 660 1100 280 1250 430 1440 350V900H0Z" fill="#2e4c3c" opacity=".25"/><path d="m0 820 200-170 160 130 220-210 210 130 180-110 250 130 220-170v350H0Z" fill="#18372a" opacity=".5"/></svg></div>
  <div class="layout play-layout"><aside class="intro"><div class="seal large">问道</div><p class="eyebrow">THE PATH WITHIN</p><h1>方寸之间<br/>自有乾坤</h1><div class="gold-line"></div><p class="intro-copy">从一手牌，走向一场修行。<br/>静心，观势，悟道。</p><div class="edition"><span>壹</span><div>云隐修炼<small>单人练习 · 移动端优先</small></div></div></aside>
  <main class="game-shell play-shell" aria-label="云隐宗练习桌">
    <header class="topbar"><a class="brand" href="/" aria-label="问道牌途"><span class="seal">道</span><span>问道牌途<small>WENDAO POKER</small></span></a><div class="header-actions"><button id="pause" class="pause-button" disabled>暂停</button><button id="sound" class="icon-button" aria-label="开启音效" aria-pressed="false">${icons.sound}<span class="mute-line"></span></button><button id="settings" class="icon-button" aria-label="体验设置">${icons.settings}</button></div></header>
    <section class="chapter"><div><span class="chapter-mark">壹</span><span>云隐山<small>盲注 10 / 20</small></span></div><button id="study" class="study-link" aria-label="打开修炼阁">修炼 <span id="progress">0/${lessons.length}</span> ›</button></section>
    <div class="live-status"><span id="stage-label">静心 · 入席</span><span id="hand-number">单人练习</span></div>
    <section class="live-table-wrap"><div id="live-table" role="img" aria-label="六人牌桌，尚未发牌"></div><div id="loading" role="status">正在铺开牌席…</div><button id="inspect" class="look-button" disabled aria-label="抬起或放下手牌">观牌</button></section>
    <section class="play-dock" aria-label="牌局操作">
      <div class="live-mentor"><span class="mentor-emblem" aria-hidden="true">玄</span><div><div class="mentor-heading">青玄师父 <button id="tutorial-open" class="mentor-badge mentor-consult">新手教学</button><button id="coach-open" class="mentor-badge mentor-consult" aria-label="请教青玄师父">请教师父 ›</button></div><p id="tip" aria-live="polite"></p></div></div>
      <div class="turn-info"><span id="turn-status" role="status">静心入席</span><span>你的灵石 <strong id="wallet">1,000</strong></span></div>
      <div id="start-panel" class="control-panel beginner-entry"><button id="learn-start" class="primary-button">从零学德州 →</button><button id="start" class="primary-button" disabled>入席修炼 <span>→</span></button></div>
      <div id="turn-panel" class="control-panel turn-actions" hidden><button id="fold" class="table-action fold-action">弃牌<small>放下此手</small></button><button id="call" class="table-action call-action">过牌<small>无需投入</small></button><button id="raise" class="table-action raise-action">加注<small>选择金额</small></button></div>
      <div id="wait-panel" class="control-panel" hidden><button id="resume" class="primary-button">继续修炼 →</button><p id="waiting" class="waiting-copy" hidden><span class="thinking-dot"></span>道友正在思考…</p></div>
      <div id="result-panel" class="control-panel result-actions" hidden><button id="review" class="review-button">本手复盘</button><button id="next" class="primary-button">下一手 →</button></div>
      <div class="dock-note"><span id="save-status" role="status">本地保存 · 单人练习</span><button id="about">玩法说明 ⓘ</button></div>
    </section>
  </main>
  <aside class="side-note"><span class="vertical-title">落子有声 · 行牌有意</span><div class="note-bottom"><span class="tiny-diamond">◇</span><p>输赢是一时，进退亦是修行。<br/>从看懂一手牌开始。</p><button id="study-desktop">进入修炼阁 →</button></div></aside></div>
  <dialog id="tutorial-dialog" aria-labelledby="tutorial-title"><div class="dialog-header"><div><p class="eyebrow">YOUR FIRST HAND</p><h2 id="tutorial-title">初入牌途 · 师父带练</h2></div><button class="close-button" aria-label="关闭新手教学">×</button></div><div id="tutorial-body"></div></dialog>
  <dialog id="raise-dialog" class="bottom-sheet" aria-labelledby="raise-title"><form id="raise-form"><div class="dialog-header"><div><p class="eyebrow">CHOOSE YOUR WAGER</p><h2 id="raise-title">落子 · 加注</h2></div><button type="button" class="close-button" aria-label="关闭加注">×</button></div><label class="amount-field" for="raise-amount"><span>本轮总投入</span><div><input id="raise-amount" type="number" inputmode="numeric" step="1" required aria-describedby="raise-detail raise-error"/><span>灵石</span></div></label><input id="raise-range" type="range" step="1" aria-label="调整本轮总投入"/><div class="bet-presets"><button type="button" data-bet="min">最小</button><button type="button" data-bet="half">半池</button><button type="button" data-bet="pot">一池</button><button type="button" data-bet="all">全下</button></div><p id="raise-detail" class="raise-detail"></p><p id="raise-error" class="input-error" role="alert"></p><button id="raise-confirm" class="primary-button sheet-confirm" type="submit">确认加注</button></form></dialog>
  <dialog id="review-dialog" class="bottom-sheet" aria-labelledby="review-title"><div class="dialog-header"><div><p class="eyebrow">LEARN FROM EVERY HAND</p><h2 id="review-title">明心 · 本手复盘</h2></div><button class="close-button" aria-label="关闭复盘">×</button></div><div id="review-body"></div></dialog>
  <dialog id="study-dialog" class="bottom-sheet" aria-labelledby="study-title"><div class="dialog-header"><div><p class="eyebrow">SMALL STEPS, DEEPER WISDOM</p><h2 id="study-title">悟道阁 · 修炼</h2></div><button class="close-button" aria-label="关闭修炼">×</button></div><div id="study-body"></div></dialog>
  <dialog id="coach-dialog" class="bottom-sheet" aria-labelledby="coach-title"><div class="dialog-header"><div><p class="eyebrow">A MOMENT OF CLARITY</p><h2 id="coach-title">问心 · 青玄师父</h2></div><button class="close-button" aria-label="关闭师父">×</button></div><p class="study-intro">先看事实，再想进退。请教时牌局会暂停，关闭后可自行继续。</p><dl id="coach-facts" class="coach-facts"></dl><p class="dialog-footnote">牌型与价格由规则程序计算。直接价格不是胜率。</p><div class="coach-topics"><button data-coach-topic="situation">看懂局面</button><button data-coach-topic="price">衡量价格</button><button data-coach-topic="review">复盘思路</button></div><div class="coach-response"><p id="coach-source" role="status"></p><p id="coach-reply" aria-live="polite"></p><button id="coach-stop" class="text-button" hidden>停止请教</button></div><p class="dialog-footnote">本地指引无需联网。启用 AI 请教时，仅发送本人底牌、公共牌与公开行动；模型不能读取牌堆或代替你操作。</p></dialog>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-header"><div><p class="eyebrow">MAKE IT YOURS</p><h2 id="settings-title">调息 · 体验设置</h2></div><button class="close-button" aria-label="关闭设置">×</button></div><label class="setting-row"><span>音效<small>轻柔的翻牌与灵石提示音</small></span><input id="sound-toggle" type="checkbox" role="switch"/></label><label class="setting-row"><span>减少动态效果<small>缩短位移与翻转，关闭装饰粒子</small></span><input id="motion-toggle" type="checkbox" role="switch"/></label><label class="setting-row"><span>灵气效果<small>均衡模式减少装饰粒子</small></span><select id="quality"><option value="fine">细腻</option><option value="balanced">均衡</option></select></label><div class="metrics"><span>当前浏览器帧间隔采样</span><strong id="fps">等待有效样本</strong><small>循环采样不等于 GPU 或手机真机性能测试。</small></div><p id="settings-feedback" class="dialog-footnote">偏好保存在本设备。</p><a class="demo-link" href="/?mode=demo">查看固定动效演示 →</a></dialog>
  <dialog id="about-dialog" aria-labelledby="about-title"><div class="dialog-header"><div><p class="eyebrow">BEGIN YOUR PRACTICE</p><h2 id="about-title">云隐宗 · 练习桌</h2></div><button class="close-button" aria-label="关闭说明">×</button></div><p class="about-copy">标准六人无限注德州扑克。每人两张底牌，与五张公共牌组合出最佳五张牌。跟注、加注或弃牌，按顺序行动。你可以通过最好的牌获胜，也可以在其他人都弃牌时获胜。</p><div class="about-callout">这是单人虚拟灵石练习。五名电脑对手采用本地策略，不读取你的底牌；师父提供本地规则指引；配置服务后可请教 AI，模型解读可能有误。</div><p class="about-copy">牌局自动保存在本设备。刷新或切后台后会暂停，点击继续即可恢复。每手结束后可复盘；灵石耗尽的座位会在下一手免费补给 1,000。</p><p class="about-copy web-install-note">Web 正式版可添加到主屏幕。首次联网加载完成后，牌局与课程可离线使用；浏览器清理网站数据会移除本地进度。新版本将在旧页面全部关闭后启用。</p><a class="demo-link" href="/?mode=demo">体验固定动效样板 →</a></dialog>
`;

const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const button = (id: string) => get<HTMLButtonElement>(id);
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const prefs = readPreferences();
const saved = loadSession();
let hand = saved.hand,
  paused = saved.paused,
  busy = true,
  ready = false,
  failed = false;
let savedOK = !saved.corrupt && storageHealthy(),
  opener: HTMLElement | null = null,
  notice = "";
let learned = loadLearning();
let completedTrials = loadTrials();
const scene = new LiveScene(prefs, {
  ready: () => {
    void initialize();
  },
  metrics: (fps, p95) => {
    get("fps").textContent =
      `${Math.round(fps)} FPS · P95 ${p95.toFixed(1)} ms`;
  },
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "live-table",
  width: 840,
  height: 1000,
  transparent: true,
  antialias: true,
  audio: { noAudio: true },
  powerPreference: "low-power",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  fps: { target: 60, forceSetTimeOut: false },
  scene,
});

async function initialize() {
  ready = true;
  get("loading").remove();
  if (hand) {
    try {
      await scene.present(observe(hand, 0), false);
    } catch (error) {
      report(error);
    }
  }
  busy = false;
  updateUI();
}
function report(error: unknown) {
  failed = true;
  paused = true;
  console.error("Practice view failed", error);
}
function persist() {
  savedOK = saveSession(hand);
}
function updateUI() {
  const trained = onboardingComplete();
  button("learn-start").textContent = trained ? "复习新手教学" : "从零学德州 →";
  button("learn-start").className = trained ? "secondary-button" : "primary-button";
  button("start").className = trained ? "primary-button" : "secondary-button";
  const view = hand ? observe(hand, 0) : null;
  const heroTurn = ready && !busy && !paused && !failed && view?.actor === 0;
  const complete = view?.street === "complete";
  get("start-panel").hidden = !!hand;
  get("turn-panel").hidden =
    !hand || !!complete || paused || failed || view?.actor !== 0;
  get("wait-panel").hidden =
    !hand || !!complete || (!paused && !failed && view?.actor === 0);
  get("result-panel").hidden = !complete;
  button("start").disabled = !ready || busy;
  button("next").disabled = busy;
  button("pause").disabled = !hand || !!complete || !ready || (paused && busy);
  button("pause").textContent = paused ? "继续" : "暂停";
  button("resume").hidden = !paused && !failed;
  button("resume").textContent = failed ? "恢复牌桌 →" : "继续修炼 →";
  button("resume").disabled = busy;
  get("waiting").hidden = paused || failed;
  button("inspect").disabled =
    !ready ||
    busy ||
    !view?.players[0].hole?.length ||
    !!view.players[0].folded;
  scene.setSelectable(!button("inspect").disabled);
  get("tip").textContent = failed
    ? "牌局已保存，点击「恢复牌桌」重新显示当前局面。"
    : guidance(view, paused);
  get("wallet").textContent = (view?.players[0].stack ?? 1000).toLocaleString();
  get("stage-label").textContent = view
    ? `${streetNames[view.street]} · ${view.street === "complete" ? "明心" : paused ? "暂停" : view.actor === 0 ? "轮到你" : "观势"}`
    : "静心 · 入席";
  get("hand-number").textContent = view
    ? `第 ${view.handNumber} 手`
    : "单人练习";
  get("turn-status").textContent = !view
    ? "静心入席"
    : complete
      ? "本手结束"
      : paused
        ? "已暂停"
        : view.actor === 0
          ? busy
            ? "正在行牌…"
            : "轮到你行动"
          : `${view.players[view.actor!].name} · 行动中`;
  get("save-status").textContent = savedOK
    ? notice ||
      (navigator.onLine ? "本地保存 · 单人练习" : "本地保存 · 离线练习")
    : saved.corrupt && !hand
      ? "旧记录无法读取，请重新入席"
      : "暂时无法保存，请保持牌局开启";
  get("progress").textContent = `${learned.length}/${lessons.length}`;
  button("study").setAttribute(
    "aria-label",
    `进入修炼阁，已完成${learned.length}项，共${lessons.length}项`,
  );
  const legal = view?.legal;
  button("fold").disabled = !heroTurn;
  button("call").disabled = !heroTurn;
  button("raise").disabled = !heroTurn || !legal?.canRaise;
  button("call").innerHTML = legal?.canCheck
    ? "过牌<small>无需投入</small>"
    : `${legal?.call === view?.players[0].stack ? "全下跟注" : "跟注"}<small>${legal?.call ?? 0} 灵石</small>`;
  button("raise").innerHTML =
    `${view?.currentBet === 0 ? "下注" : "加注"}<small>${legal?.canRaise ? "选择金额" : "本轮不可加注"}</small>`;
  button("raise-confirm").disabled = !heroTurn;
  get("live-table").setAttribute(
    "aria-label",
    view
      ? `${streetNames[view.street]}，公共牌 ${view.board.map(cardText).join(" ") || "尚未发出"}，底池${view.pot}，你的底牌${view.players[0].hole?.map(cardText).join(" ") || "已弃牌"}`
      : "六人牌桌，尚未发牌",
  );
  get("live-table").dataset.street = view?.street || "ready";
  get("live-table").dataset.actor = String(view?.actor ?? "none");
  get("live-table").dataset.busy = String(busy);
}

async function present(animated = true) {
  persist();
  await flushStorage();
  updateUI();
  if (hand) await scene.present(observe(hand, 0), animated);
}
async function begin() {
  if (busy || !ready || (hand && hand.street !== "complete")) return;
  busy = true;
  paused = false;
  failed = false;
  scene.feedback.unlock();
  try {
    const next = nextHand(hand);
    hand = next.hand;
    notice = next.refilled ? "耗尽座位已免费补给 1,000" : "";
    await present();
  } catch (error) {
    report(error);
  } finally {
    busy = false;
    updateUI();
  }
  void pump();
}
async function requestAction(action: Action) {
  if (busy || paused || failed || hand?.actor !== 0) return;
  busy = true;
  scene.feedback.unlock();
  updateUI();
  try {
    hand = act(hand, 0, action);
    await present();
  } catch (error) {
    report(error);
  } finally {
    busy = false;
    updateUI();
  }
  void pump();
}
async function pump() {
  if (
    busy ||
    paused ||
    failed ||
    document.hidden ||
    !hand ||
    hand.actor === null ||
    hand.actor === 0
  )
    return;
  busy = true;
  updateUI();
  try {
    while (
      hand.actor !== null &&
      hand.actor !== 0 &&
      !paused &&
      !document.hidden
    ) {
      const actor = hand.actor;
      // Opponents receive exactly the same visibility-filtered API as the user.
      const action = chooseAction(observe(hand, actor), actor);
      hand = act(hand, actor, action);
      await present();
      if (!prefs.reducedMotion)
        await new Promise<void>((resolve) => setTimeout(resolve, 180));
    }
  } catch (error) {
    report(error);
  } finally {
    busy = false;
    updateUI();
  }
}
async function resume() {
  if (busy || !hand) return;
  void scene.feedback.unlock();
  if (failed) {
    busy = true;
    try {
      await scene.present(observe(hand, 0), false);
      failed = false;
    } catch (error) {
      report(error);
    } finally {
      busy = false;
    }
  }
  if (!failed) {
    paused = false;
    updateUI();
    void pump();
  }
}
function togglePause() {
  if (!hand || hand.street === "complete") return;
  if (paused) void resume();
  else {
    paused = true;
    persist();
    updateUI();
  }
}
button("start").addEventListener("click", () => void begin());
button("next").addEventListener("click", () => void begin());
button("fold").addEventListener(
  "click",
  () => void requestAction({ type: "fold" }),
);
button("call").addEventListener("click", () => {
  if (!hand) return;
  const legal = legalActions(hand, 0);
  if (legal) void requestAction({ type: legal.canCheck ? "check" : "call" });
});
button("pause").addEventListener("click", togglePause);
button("resume").addEventListener("click", () => void resume());
button("inspect").addEventListener("click", () => scene.liftHand());
document.querySelector(".brand")!.addEventListener("click", (event) => {
  event.preventDefault();
  open("about-dialog", event.currentTarget as HTMLElement);
});

function open(id: string, source: HTMLElement) {
  opener = source;
  get<HTMLDialogElement>(id).showModal();
}
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog
    .querySelector(".close-button")!
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => opener?.focus());
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
});
button("settings").addEventListener("click", (event) =>
  open("settings-dialog", event.currentTarget as HTMLElement),
);
button("about").addEventListener("click", (event) =>
  open("about-dialog", event.currentTarget as HTMLElement),
);

function beginTutorial() {
  if (hand && hand.street !== "complete") {
    paused = true;
    persist();
    updateUI();
  }
  openOnboarding(get("tutorial-body"), () => get<HTMLDialogElement>("tutorial-dialog").close());
  open("tutorial-dialog", button("tutorial-open"));
}
button("tutorial-open").addEventListener("click", beginTutorial);
button("learn-start").addEventListener("click", beginTutorial);
get("tutorial-dialog").addEventListener("close", updateUI);

const mentor = createMentorPanel(get<HTMLDialogElement>("coach-dialog"));
button("coach-open").addEventListener("click", (event) => {
  if (hand && hand.street !== "complete") {
    paused = true;
    persist();
    updateUI();
  }
  mentor.prepare(hand ? observe(hand, 0) : null);
  open("coach-dialog", event.currentTarget as HTMLElement);
});

function setAmount(amount: number) {
  get<HTMLInputElement>("raise-amount").value = String(amount);
  get<HTMLInputElement>("raise-range").value = String(amount);
  amountChanged();
}
function amountChanged() {
  const legal = hand ? legalActions(hand, 0) : null;
  const amount = Number(get<HTMLInputElement>("raise-amount").value);
  const valid =
    !!legal &&
    Number.isSafeInteger(amount) &&
    amount <= legal.maxTo &&
    amount >= Math.min(legal.minTo, legal.maxTo);
  get("raise-detail").textContent = valid
    ? `本次追加 ${amount - hand!.players[0].streetBet} 灵石 · 剩余 ${hand!.players[0].stack - (amount - hand!.players[0].streetBet)} 灵石`
    : legal
      ? `请输入 ${Math.min(legal.minTo, legal.maxTo)} 至 ${legal.maxTo} 的整数`
      : "";
  get("raise-error").textContent = valid
    ? ""
    : legal
      ? "金额超出本轮允许范围"
      : "";
  button("raise-confirm").disabled = !valid || paused || busy;
  if (valid) {
    const range = get<HTMLInputElement>("raise-range");
    range.value = String(amount);
    const min = Number(range.min),
      max = Number(range.max);
    range.style.setProperty(
      "--progress",
      `${max > min ? ((amount - min) / (max - min)) * 100 : 0}%`,
    );
  }
}
button("raise").addEventListener("click", (event) => {
  if (!hand || paused || busy) return;
  const legal = legalActions(hand, 0);
  if (!legal?.canRaise) return;
  const min = Math.min(legal.minTo, legal.maxTo);
  ["raise-amount", "raise-range"].forEach((id) => {
    get<HTMLInputElement>(id).min = String(min);
    get<HTMLInputElement>(id).max = String(legal.maxTo);
  });
  get<HTMLInputElement>("raise-range").disabled = min === legal.maxTo;
  get("raise-title").textContent =
    hand.currentBet === 0 ? "落子 · 下注" : "落子 · 加注";
  setAmount(min);
  open("raise-dialog", event.currentTarget as HTMLElement);
  // Avoid automatically opening the software keyboard when the sheet appears.
  button("raise-confirm").focus();
});
get<HTMLInputElement>("raise-amount").addEventListener("input", amountChanged);
get<HTMLInputElement>("raise-range").addEventListener("input", (event) =>
  setAmount(Number((event.target as HTMLInputElement).value)),
);
document.querySelectorAll<HTMLButtonElement>("[data-bet]").forEach((el) =>
  el.addEventListener("click", () => {
    if (!hand) return;
    const legal = legalActions(hand, 0);
    if (!legal) return;
    const pot = observe(hand, 0).pot;
    const target =
      el.dataset.bet === "all"
        ? legal.maxTo
        : el.dataset.bet === "half"
          ? hand.currentBet + Math.round((pot + legal.call) / 2)
          : el.dataset.bet === "pot"
            ? hand.currentBet + pot + legal.call
            : legal.minTo;
    setAmount(
      Math.min(
        legal.maxTo,
        Math.max(Math.min(legal.minTo, legal.maxTo), target),
      ),
    );
  }),
);
get<HTMLFormElement>("raise-form").addEventListener("submit", (event) => {
  event.preventDefault();
  amountChanged();
  if (button("raise-confirm").disabled) return;
  const to = Number(get<HTMLInputElement>("raise-amount").value);
  get<HTMLDialogElement>("raise-dialog").close();
  void requestAction({ type: "raise", to });
});

button("review").addEventListener("click", (event) => {
  if (!hand?.result) return;
  const result = hand.result,
    hero = hand.players[0],
    net = hero.stack - hero.startingStack;
  const winnerText = result.pots
    .filter((p) => !p.refund)
    .map(
      (pot, i) =>
        `<div class="pot-row"><span>${i === 0 ? "主池" : `边池 ${i}`} · ${pot.amount}</span><strong>${pot.winners.map((i) => escape(hand!.players[i].name)).join(" / ")}</strong></div>`,
    )
    .join("");
  const ownHand = result.hands[0];
  get("review-body").innerHTML =
    `<div class="review-summary"><span>第 ${hand.handNumber} 手 · ${result.showdown ? "摊牌结算" : "弃牌获胜"}</span><strong>${net >= 0 ? "+" : "−"}${Math.abs(net)} <small>灵石</small></strong><p>${ownHand ? `${escape(ownHand.name)} · ${ownHand.cards.map(cardText).map(escape).join(" ")}` : hero.folded ? "你已弃牌；对手未公开的底牌仍然隐藏。" : "其余玩家弃牌，本手无需摊牌。"}</p></div>${winnerText}${result.pots
      .filter((p) => p.refund)
      .map(
        (p) =>
          `<p class="refund-note">未获跟注的 ${p.amount} 灵石已返还给 ${escape(hand!.players[p.winners[0]].name)}。</p>`,
      )
      .join(
        "",
      )}<h3 class="section-label">回顾行动</h3><ol class="action-history">${hand.log.map((e) => `<li class="${e.seat === 0 ? "hero-log" : ""}"><span>${streetNames[e.street]} · ${escape(hand!.players[e.seat].name)}</span><strong>${escape(e.text)}</strong></li>`).join("")}</ol><p class="dialog-footnote">记录展示当时的公开行动。输赢不代表决策优劣；当前不提供未经验证的策略评分。</p>`;
  open("review-dialog", event.currentTarget as HTMLElement);
});

let lessonIndex: number | null = null,
  questionIndex = 0,
  answered = false;
function lessonList() {
  lessonIndex = null;
  const sections = learningStages.map((stage, n) => {
    const cards = lessons.map((lesson, i) => lesson.stage !== n ? "" : `
      <button class="lesson-card" data-lesson="${i}" ${isLessonUnlocked(i, learned) ? "" : "disabled"}>
        <span class="lesson-number">${["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"][i]}</span>
        <span><strong>${lesson.title}</strong><small>${lesson.subtitle} · ${lesson.questions.length} 道练习</small></span>
        <span class="lesson-status">${learned.includes(lesson.id) ? "已完成 ✓" : isLessonUnlocked(i, learned) ? "修炼 →" : "待突破"}</span>
      </button>`).join("");
    const checkpoint = trials.filter(t => t.stage === n).map(t => {
      const unlocked = isTrialUnlocked(t.id, learned), passed = completedTrials.includes(t.id);
      return `<button class="trial-entry" data-trial="${t.id}" ${unlocked ? "" : "disabled"}>
        <span class="trial-entry-mark">${passed ? "悟" : "试"}</span>
        <span><strong>${t.title}</strong><small>${unlocked ? t.subtitle : "完成本境三课后开放"}</small></span>
        <span>${passed ? "已达成 ✓" : "入境 →"}</span>
      </button>`;
    }).join("");
    return `<section class="learning-stage"><h3 class="section-label">${stage.title}<small>${stage.detail}</small></h3>${cards}${checkpoint}</section>`;
  }).join("");
  get("study-body").innerHTML = `
    <button type="button" id="study-beginner" class="tutorial-entry-card"><span class="seal">初</span><span><strong>完全不懂？先跟师父学第一手</strong><small>看懂牌面 · 亲手操作 · 再来做课程练习</small></span><span>→</span></button>
    <p class="study-intro">每次练一点，先看懂，再上桌。完成当前境界三课，开启下一境。</p>
    <div class="realm-progress"><span>${learningRealm(learned)}</span><span>${learned.length} / ${lessons.length}</span></div>
    ${sections}<p class="trial-progress">问心试炼 ${completedTrials.length} / ${trials.length}</p>
    <p class="dialog-footnote">境界只表示本设备的课程进度。预设试炼独立于练习桌，不作为实战能力评级。</p>`;
  get("study-beginner").addEventListener("click", () => { get<HTMLDialogElement>("study-dialog").close(); beginTutorial(); });
  bindTrials();
  get("study-body")
    .querySelectorAll<HTMLButtonElement>("[data-lesson]")
    .forEach((el) =>
      el.addEventListener("click", () => {
        lessonIndex = Number(el.dataset.lesson);
        if (!isLessonUnlocked(lessonIndex, learned)) return;
        questionIndex = 0;
        renderQuestion();
      }),
    );
}
function bindTrials() {
  get("study-body").querySelectorAll<HTMLButtonElement>("[data-trial]").forEach(el => {
    el.addEventListener("click", () => {
      const trial = trials.find(t => t.id === el.dataset.trial);
      if (!trial || !isTrialUnlocked(trial.id, learned)) return;
      const backToTrial = () => {
        lessonList();
        const entry = get("study-body").querySelector<HTMLButtonElement>(`[data-trial="${trial.id}"]`)!;
        entry.focus({ preventScroll: true });
        entry.scrollIntoView({ block: "center" });
      };
      openTrialPanel(get("study-body"), trial.id, backToTrial, async id => {
        if (!completedTrials.includes(id)) completedTrials.push(id);
        const ok = saveTrials(completedTrials);
        await flushStorage();
        return ok && storageHealthy();
      });
    });
  });
}
function renderQuestion() {
  const lesson = lessons[lessonIndex!],
    question = lesson.questions[questionIndex];
  answered = false;
  get("study-body").innerHTML =
    `<button id="lesson-back" class="text-button">← 返回修炼阁</button><p class="quiz-count">${lesson.title} · ${questionIndex + 1} / ${lesson.questions.length}</p><h3 class="quiz-prompt">${question.prompt}</h3><div class="quiz-options">${question.choices.map((choice, i) => `<button data-answer="${i}"><span>${["甲", "乙", "丙"][i]}</span>${choice}</button>`).join("")}</div><p id="quiz-feedback" class="quiz-feedback" role="status"></p><button id="quiz-next" class="primary-button sheet-confirm" aria-label="${questionIndex < lesson.questions.length - 1 ? "下一道课程练习" : "保存本课进度"}" hidden>${questionIndex < lesson.questions.length - 1 ? "继续修炼 →" : "完成修炼 ✓"}</button>`;
  button("lesson-back").addEventListener("click", lessonList);
  get("study-body")
    .querySelectorAll<HTMLButtonElement>("[data-answer]")
    .forEach((el) =>
      el.addEventListener("click", () => {
        if (answered) return;
        const correct = Number(el.dataset.answer) === question.answer;
        get("quiz-feedback").textContent = correct
          ? `答对了。${question.why}`
          : "再想一想，可以重新选择。";
        el.classList.add(correct ? "correct" : "incorrect");
        if (correct) {
          answered = true;
          button("quiz-next").hidden = false;
          get("study-body")
            .querySelectorAll<HTMLButtonElement>("[data-answer]")
            .forEach((b) => (b.disabled = true));
        }
      }),
    );
  button("quiz-next").addEventListener("click", () => {
    if (!answered) return;
    if (questionIndex < lesson.questions.length - 1) {
      questionIndex++;
      renderQuestion();
    } else {
      if (!learned.includes(lesson.id)) learned.push(lesson.id);
      const ok = saveLearning(learned);
      lessonList();
      updateUI();
      if (!ok)
        get("study-body").insertAdjacentHTML(
          "beforeend",
          '<p class="input-error">暂时无法保存进度，本次仍可继续练习。</p>',
        );
    }
  });
}
function openStudy(source: HTMLElement) {
  if (hand && hand.street !== "complete") {
    paused = true;
    persist();
    updateUI();
  }
  lessonList();
  open("study-dialog", source);
}
["study", "study-desktop"].forEach((id) =>
  button(id).addEventListener("click", (event) =>
    openStudy(event.currentTarget as HTMLElement),
  ),
);

function syncPreferences() {
  button("sound").setAttribute("aria-pressed", String(prefs.sound));
  button("sound").setAttribute(
    "aria-label",
    prefs.sound ? "关闭音效" : "开启音效",
  );
  button("sound").classList.toggle("is-muted", !prefs.sound);
  get<HTMLInputElement>("sound-toggle").checked = prefs.sound;
  get<HTMLInputElement>("motion-toggle").checked = prefs.reducedMotion;
  get<HTMLSelectElement>("quality").value = prefs.quality;
  document.documentElement.classList.toggle(
    "reduced-motion",
    prefs.reducedMotion,
  );
  scene.applyPreferences();
}
function persistPreferences() {
  syncPreferences();
  get("settings-feedback").textContent = savePreferences(prefs)
    ? "偏好已保存到本设备。"
    : "暂时无法保存偏好，仅在本次生效。";
}
button("sound").addEventListener("click", () => {
  prefs.sound = !prefs.sound;
  persistPreferences();
  void scene.feedback.preview("card");
});
get<HTMLInputElement>("sound-toggle").addEventListener("change", (event) => {
  prefs.sound = (event.target as HTMLInputElement).checked;
  persistPreferences();
  void scene.feedback.preview("card");
});
get<HTMLInputElement>("motion-toggle").addEventListener("change", (event) => {
  prefs.reducedMotion = (event.target as HTMLInputElement).checked;
  persistPreferences();
});
get<HTMLSelectElement>("quality").addEventListener("change", (event) => {
  prefs.quality =
    (event.target as HTMLSelectElement).value === "balanced"
      ? "balanced"
      : "fine";
  persistPreferences();
});
syncPreferences();
updateUI();
document.addEventListener("visibilitychange", () => {
  if (document.hidden && hand && hand.street !== "complete") {
    paused = true;
    persist();
    updateUI();
  }
});
window.addEventListener("pagehide", persist);
window.addEventListener("wendao:suspend", () => {
  if (hand && hand.street !== "complete") {
    paused = true;
    persist();
    updateUI();
  }
});
window.addEventListener("wendao:storage-error", () => {
  savedOK = false;
  updateUI();
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    mentor.dispose();
    game.destroy(true);
  });

window.addEventListener("online", updateUI);
window.addEventListener("offline", updateUI);
