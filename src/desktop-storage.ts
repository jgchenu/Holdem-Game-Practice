import { invoke } from '@tauri-apps/api/core';
import type { PersistenceBackend } from './storage';

export async function desktopStorage(): Promise<PersistenceBackend> {
  const values = await invoke<Record<string, string>>('load_practice_store');
  return {
    get: async ({ key }) => ({ value: values[key] ?? null }),
    set: async ({ key, value }) => {
      await invoke('set_practice_value', { key, value });
      values[key] = value;
    },
  };
}
