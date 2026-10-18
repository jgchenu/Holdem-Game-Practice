import { Capacitor, registerPlugin } from "@capacitor/core";
import { flushStorage, initializeStorage } from "./storage";

export async function dismissLaunchScreen() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (import.meta.env.VITE_STARTUP_TRACE === '1') document.getElementById('app')!.dataset.bootDetail = 'splash-import';
    const { SplashScreen } = await import("@capacitor/splash-screen");
    const fadeOutDuration = 200;
    if (import.meta.env.VITE_STARTUP_TRACE === '1') document.getElementById('app')!.dataset.bootDetail = 'splash-native-hide';
    await SplashScreen.hide({ fadeOutDuration });
    if (Capacitor.getPlatform() === 'ios') {
      if (import.meta.env.VITE_STARTUP_TRACE === '1') document.getElementById('app')!.dataset.bootDetail = 'splash-native-ready';
      const startup = registerPlugin<{waitForLaunchReady(): Promise<{interactionReady: boolean; nativeWaitMs: number}>}>('PracticeStartup');
      const result = await startup.waitForLaunchReady();
      if (!result.interactionReady) throw new Error('Native launch is not interactive');
    } else {
      if (import.meta.env.VITE_STARTUP_TRACE === '1') document.getElementById('app')!.dataset.bootDetail = 'splash-fade-wait';
      await new Promise<void>(resolve => setTimeout(resolve, fadeOutDuration));
    }
    if (import.meta.env.VITE_STARTUP_TRACE === '1') document.getElementById('app')!.dataset.bootDetail = 'splash-finished';
  } catch (error) {
    if (import.meta.env.VITE_STARTUP_TRACE === '1') document.getElementById('app')!.dataset.bootDetail = 'splash-error';
    console.error("Native launch screen could not be dismissed", error);
    throw error;
  }
}

export async function initializePlatform(): Promise<() => void> {
  await initializeStorage();
  if (!Capacitor.isNativePlatform()) return () => {};
  const { App } = await import("@capacitor/app");
  const state = await App.addListener(
    "appStateChange",
    async ({ isActive }) => {
      if (!isActive) {
        window.dispatchEvent(new Event("wendao:suspend"));
        await flushStorage();
      }
    },
  );
  const back = await App.addListener("backButton", async () => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    if (dialog) {
      dialog.close();
      return;
    }
    window.dispatchEvent(new Event("wendao:suspend"));
    await flushStorage();
    await App.minimizeApp();
  });
  return () => {
    void state.remove();
    void back.remove();
  };
}
