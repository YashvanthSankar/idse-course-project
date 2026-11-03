import { describe, expect, it } from "vitest";
import { clueWarning, defaultPick, requiredClues } from "./accusation";
import type { ToolResult } from "./types";

const r = (id: string, implicates: string[]) => ({ result_id: id, implicates }) as unknown as ToolResult;
const name = (id: string) => ({ E1: "Asha", E2: "Bilal" })[id] ?? id;

describe("requiredClues", () => {
  it("needs two clues while there is budget", () => {
    expect(requiredClues(3, 0)).toBe(2);
    expect(requiredClues(1, 5)).toBe(2);
  });
  it("when broke, needs every clue you have (up to two)", () => {
    expect(requiredClues(0, 0)).toBe(0);
    expect(requiredClues(0, 1)).toBe(1);
    expect(requiredClues(0, 4)).toBe(2);
  });
});

describe("clueWarning", () => {
  it("is silent for a clue that points at the accused", () => {
    expect(clueWarning(r("a", ["E1"]), "E1", name)).toBeNull();
  });
  it("warns when the clue doesn't point at the accused", () => {
    expect(clueWarning(r("a", ["E2"]), "E1", name)).toEqual({ tone: "bad", text: "Doesn't point at Asha · −100" });
    expect(clueWarning(r("a", []), "E1", name)?.tone).toBe("bad");
  });
  it("flags clues that point at half the company as weak", () => {
    expect(clueWarning(r("a", ["E1", "E2", "E3"]), "E1", name)).toEqual({ tone: "weak", text: "Points at 3 people · weak" });
  });
});

describe("defaultPick", () => {
  it("prefers clues that point only at the accused", () => {
    const ev = [r("wide", ["E1", "E2", "E3"]), r("miss", ["E2"]), r("sharp", ["E1"]), r("pair", ["E1", "E2"])];
    expect(defaultPick(ev, "E1", 2)).toEqual(["sharp", "pair"]);
  });
  it("never picks more than asked", () => {
    expect(defaultPick([r("a", ["E1"])], "E1", 2)).toEqual(["a"]);
    expect(defaultPick([r("a", ["E1"]), r("b", ["E1"])], "E1", 0)).toEqual([]);
  });
});
