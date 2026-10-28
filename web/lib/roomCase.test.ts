import { describe, expect, it } from "vitest";
import { rememberRoomCase, roomForCase } from "./roomCase";

const mem = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v) };
};

describe("room ↔ case memory", () => {
  it("remembers which class room a case came from", () => {
    const s = mem();
    rememberRoomCase("abc123", "DYJM", s);
    expect(roomForCase("abc123", s)).toBe("DYJM");
    expect(roomForCase("solo99", s)).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
    expect(() => rememberRoomCase("a", "B", blocked)).not.toThrow();
    expect(roomForCase("a", blocked)).toBeNull();
  });
});
