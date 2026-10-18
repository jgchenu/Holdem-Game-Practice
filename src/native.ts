import { Capacitor } from "@capacitor/core";
import { flushStorage, initializeStorage } from "./storage";

export async function dismissLaunchScreen() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    const fadeOutDuration = 200;
    await SplashScreen.hide({ fadeOutDuration });
    // Capacitor 8 resolves hide() when the native transition is scheduled,
    // before its fade finishes. Keep the interface guard for that interval.
    await new Promise<void>(resolve => setTimeout(resolve, fadeOutDuration));
  } catch (error) {
    console.error("Native launch screen could not be dismissed", error);
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
