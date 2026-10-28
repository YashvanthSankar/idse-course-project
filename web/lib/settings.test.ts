import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("settings persistence", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", () => {
    const store = memoryStorage();
    saveSettings(store, { volume: 0.3, muted: true, reduceEffects: true, unlockAll: true });
    expect(loadSettings(store)).toEqual({ volume: 0.3, muted: true, reduceEffects: true, unlockAll: true });
  });

  it("survives corrupted JSON and throwing storage", () => {
    const store = memoryStorage();
    store.setItem("auditor.settings.v1", "{not json");
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(throwing, DEFAULT_SETTINGS)).not.toThrow();
  });

  it("clamps volume into 0..1", () => {
    const store = memoryStorage();
    store.setItem("auditor.settings.v1", JSON.stringify({ volume: 7 }));
    expect(loadSettings(store).volume).toBe(1);
  });
});

describe("unlock all cases", () => {
  it("is off by default and survives older saved settings", () => {
    expect(DEFAULT_SETTINGS.unlockAll).toBe(false);
    const store = memoryStorage();
    store.setItem("auditor.settings.v1", JSON.stringify({ volume: 0.5, muted: false, reduceEffects: false }));
    expect(loadSettings(store).unlockAll).toBe(false);
  });
});
