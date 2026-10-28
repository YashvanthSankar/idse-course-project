import { describe, expect, it } from "vitest";
import { loadHostToken, saveHostToken } from "./hostToken";
import { roomSocketUrl } from "./ws";

const mem = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v) };
};

describe("host token", () => {
  it("is remembered per room code", () => {
    const s = mem();
    saveHostToken("ABCD", "secret-1", s);
    expect(loadHostToken("ABCD", s)).toBe("secret-1");
    expect(loadHostToken("WXYZ", s)).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(() => saveHostToken("ABCD", "t", blocked)).not.toThrow();
    expect(loadHostToken("ABCD", blocked)).toBeNull();
  });

  it("goes on the host socket URL", () => {
    expect(roomSocketUrl("http://localhost:8000", "ABCD", "host", { token: "t 1" })).toBe(
      "ws://localhost:8000/ws/rooms/ABCD?role=host&token=t+1",
    );
  });
});
