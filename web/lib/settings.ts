import { create } from "zustand";

export type Settings = { volume: number; muted: boolean; reduceEffects: boolean; unlockAll: boolean };
type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

const KEY = "auditor.settings.v1";
export const DEFAULT_SETTINGS: Settings = { volume: 0.7, muted: false, reduceEffects: false, unlockAll: false };

export function loadSettings(storage: KV): Settings {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
    return { ...parsed, volume: Math.min(1, Math.max(0, Number(parsed.volume) || 0)) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(storage: KV, settings: Settings): void {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: settings just won't persist.
  }
}

function browserStorage(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

type SettingsState = Settings & {
  hydrate: () => void;
  update: (patch: Partial<Settings>) => void;
};

export const useSettings = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrate: () => {
    const storage = browserStorage();
    if (storage) set(loadSettings(storage));
  },
  update: (patch) => {
    set(patch);
    const { volume, muted, reduceEffects, unlockAll } = get();
    const storage = browserStorage();
    if (storage) saveSettings(storage, { volume, muted, reduceEffects, unlockAll });
  },
}));
