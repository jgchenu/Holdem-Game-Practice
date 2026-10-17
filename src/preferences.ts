import { readStorage,writeStorage } from './storage';
export type Preferences = {
  sound: boolean;
  reducedMotion: boolean;
  quality: "balanced" | "fine";
};
export const defaultPreferences = (): Preferences => ({
  sound: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  quality: "fine",
});

export function readPreferences(): Preferences {
  const defaults = defaultPreferences();
  try {
    const value = JSON.parse(
      readStorage("wendao:preferences:v1") || "{}",
    );
    return {
      sound: typeof value.sound === "boolean" ? value.sound : defaults.sound,
      reducedMotion:
        typeof value.reducedMotion === "boolean"
          ? value.reducedMotion
          : defaults.reducedMotion,
      quality: value.quality === "balanced" ? "balanced" : "fine",
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(value: Preferences): boolean {
  try {
    return writeStorage("wendao:preferences:v1", JSON.stringify(value));
  } catch {
    return false;
  }
}
