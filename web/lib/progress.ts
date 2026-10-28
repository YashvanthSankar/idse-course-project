export type Progress = { unlocked: number; best: Record<number, number> };
type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

const KEY = "auditor.progress.v1";
export const MAX_LEVEL = 7;
export const EMPTY_PROGRESS: Progress = { unlocked: 1, best: {} };

export const isUnlocked = (p: Progress, level: number) => level <= p.unlocked;

export function recordResult(p: Progress, level: number, correct: boolean, score: number): Progress {
  if (!correct) return p;
  return {
    unlocked: Math.min(MAX_LEVEL, Math.max(p.unlocked, level + 1)),
    best: { ...p.best, [level]: Math.max(p.best[level] ?? 0, score) },
  };
}

export function loadProgress(storage: KV | null): Progress {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Progress;
    if (typeof parsed.unlocked !== "number" || typeof parsed.best !== "object") return EMPTY_PROGRESS;
    return parsed;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(storage: KV | null, p: Progress): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable — progress lives for this session only
  }
}

export function browserStorage(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
