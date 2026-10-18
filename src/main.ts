import "./style.css";
import { dismissLaunchScreen, initializePlatform } from "./native";
import { initializeOffline } from "./offline";
import { prepareFonts } from "./fonts";

const appRoot = document.querySelector<HTMLDivElement>("#app")!;
// The DOM can reach native accessibility before event handlers and the splash
// transition finish. Expose controls only once they can actually receive input.
appRoot.inert = true;
let practiceReady: Promise<void> | undefined;
let disposePractice: (() => void) | undefined;
let launchDismissed = false;
const phase = (value: string) => { appRoot.dataset.bootPhase = value; };
try {
  phase('platform');
  if (import.meta.env.VITE_STARTUP_TRACE === '1') {
    (await import('./startup-trace')).initializeStartupTrace();
  }
  const dispose = await initializePlatform();
  if (import.meta.env.VITE_NATIVE_AUDIT === '1') {
    await (await import('./native-audit')).initializeNativeAudit();
  }
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  phase('fonts');
  await prepareFonts();
  initializeOffline();
  phase('interface');
  if (new URLSearchParams(location.search).get("mode") === "demo") {
    await import("./demo-ui");
  } else {
    const practice = await import("./play-ui");
    practiceReady = practice.practiceReady;
    disposePractice = practice.disposePractice;
  }
  // Let the WebView become visible before waiting for Phaser's first scene.
  // Occluded native WebViews can postpone rendering; input remains guarded.
  phase('launch-screen');
  await dismissLaunchScreen();
  launchDismissed = true;
  phase('renderer');
  await practiceReady;
  phase('ready');
} catch (error) {
  disposePractice?.();
  phase('failed');
  console.error("Practice startup failed", error);
  document.querySelector("#app")!.innerHTML =
    '<div class="boot-screen" role="alert"><img src="/icon.png" alt="" width="76" height="76"/><h1>问道牌途</h1><p>暂时未能铺开牌席。请检查网络后重试；你的本地进度会继续保留。</p><button id="boot-retry">重新入境 →</button></div>';
  document
    .querySelector("#boot-retry")!
    .addEventListener("click", () => location.reload());
} finally {
  // Keep native artwork visible through the first WebView navigation. Release
  // it after either the game UI or the recoverable error screen is mounted.
  try { if (!launchDismissed) await dismissLaunchScreen(); }
  catch (error) { console.error('Native recovery screen handover failed', error); }
  finally { appRoot.inert = false; }
}
