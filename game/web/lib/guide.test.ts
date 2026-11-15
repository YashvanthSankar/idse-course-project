import { describe, expect, it } from "vitest";
import { GUIDE_KEY, guideSeen, markGuideSeen } from "./guide";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

describe("site guide", () => {
  it("opens on the first visit and not after it has been seen", () => {
    const storage = memory();
    expect(guideSeen(storage)).toBe(false);
    markGuideSeen(storage);
    expect(storage.getItem(GUIDE_KEY)).toBe("1");
    expect(guideSeen(storage)).toBe(true);
  });

  it("stays closed when storage is missing or throws", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(guideSeen(null)).toBe(true);
    expect(guideSeen(broken)).toBe(true);
    expect(() => markGuideSeen(broken)).not.toThrow();
  });
});
