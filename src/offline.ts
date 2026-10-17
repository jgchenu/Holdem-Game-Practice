import { Capacitor } from '@capacitor/core';

export function initializeOffline() {
  const native = Capacitor.isNativePlatform() || '__TAURI_INTERNALS__' in window;
  document.documentElement.dataset.platform = native ? 'native' : 'web';
  if (!import.meta.env.PROD || native || !('serviceWorker' in navigator) || !isSecureContext) return;
  // Failure leaves the online game available. No forced refresh while playing.
  void navigator.serviceWorker.register('/sw.js').catch(() => {
    document.documentElement.dataset.offlineCache = 'unavailable';
  });
}
