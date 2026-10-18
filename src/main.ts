import "./style.css";
import { dismissLaunchScreen, initializePlatform } from "./native";
import { initializeOffline } from "./offline";
import { prepareFonts } from "./fonts";

const appRoot = document.querySelector<HTMLDivElement>("#app")!;
// The DOM can reach native accessibility before event handlers and the splash
// transition finish. Expose controls only once they can actually receive input.
appRoot.inert = true;
try {
  if (import.meta.env.VITE_STARTUP_TRACE === '1') {
    (await import('./startup-trace')).initializeStartupTrace();
  }
  const dispose = await initializePlatform();
  if (import.meta.env.VITE_NATIVE_AUDIT === '1') {
    await (await import('./native-audit')).initializeNativeAudit();
  }
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  await prepareFonts();
  initializeOffline();
  if (new URLSearchParams(location.search).get("mode") === "demo") {
    await import("./demo-ui");
  } else {
    const { practiceReady } = await import("./play-ui");
    await practiceReady;
  }
} catch (error) {
  console.error("Practice startup failed", error);
  document.querySelector("#app")!.innerHTML =
    '<div class="boot-screen" role="alert"><img src="/icon.png" alt="" width="76" height="76"/><h1>问道牌途</h1><p>暂时未能铺开牌席。请检查网络后重试；你的本地进度会继续保留。</p><button id="boot-retry">重新入境 →</button></div>';
  document
    .querySelector("#boot-retry")!
    .addEventListener("click", () => location.reload());
} finally {
  // Keep native artwork visible through the first WebView navigation. Release
  // it after either the game UI or the recoverable error screen is mounted.
  try {
    await dismissLaunchScreen();
  } finally {
    appRoot.inert = false;
  }
}
