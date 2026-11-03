import { describe, expect, it } from "vitest";
import { EMPTY_PROGRESS, isUnlocked, loadProgress, recordResult, saveProgress } from "./progress";

const mem = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v) };
};

describe("progress", () => {
  it("starts with only level 1 unlocked", () => {
    expect(isUnlocked(EMPTY_PROGRESS, 1)).toBe(true);
    expect(isUnlocked(EMPTY_PROGRESS, 2)).toBe(false);
  });

  it("a correct verdict unlocks the next level and keeps the best score", () => {
    let p = recordResult(EMPTY_PROGRESS, 1, true, 1200);
    expect(isUnlocked(p, 2)).toBe(true);
    p = recordResult(p, 1, true, 900);
    expect(p.best[1]).toBe(1200);
    p = recordResult(p, 1, true, 1500);
    expect(p.best[1]).toBe(1500);
  });

  it("a wrong verdict unlocks nothing", () => {
    const p = recordResult(EMPTY_PROGRESS, 1, false, 0);
    expect(isUnlocked(p, 2)).toBe(false);
    expect(p.best[1]).toBeUndefined();
  });

  it("never unlocks beyond level 7", () => {
    let p = EMPTY_PROGRESS;
    for (let l = 1; l <= 7; l++) p = recordResult(p, l, true, 1000);
    expect(p.unlocked).toBe(7);
  });

  it("persists through storage and tolerates garbage", () => {
    const s = mem();
    saveProgress(s, recordResult(EMPTY_PROGRESS, 1, true, 1000));
    expect(loadProgress(s).unlocked).toBe(2);
    s.setItem("auditor.progress.v1", "nope");
    expect(loadProgress(s)).toEqual(EMPTY_PROGRESS);
  });
});

describe("progressSummary", () => {
  it("counts closed cases and the best score", async () => {
    const { progressSummary } = await import("./progress");
    expect(progressSummary(EMPTY_PROGRESS)).toEqual({ closed: 0, best: 0 });
    let p = recordResult(EMPTY_PROGRESS, 1, true, 1200);
    p = recordResult(p, 2, true, 1540);
    expect(progressSummary(p)).toEqual({ closed: 2, best: 1540 });
  });
});
