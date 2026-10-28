import { describe, expect, it } from "vitest";
import { loadCaseMemory, restoreSnapshot, saveCaseMemory } from "./caseMemory";
import type { CaseState, ToolResult } from "./types";

const mem = () => {
  const d = new Map<string, string>();
  return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v) };
};
const result = (id: string) => ({ result_id: id }) as unknown as ToolResult;
const state = (ids: string[], verdict: unknown = null) =>
  ({ meta: { case_id: "c1" }, results: ids.map(result), verdict }) as unknown as CaseState;

describe("case memory", () => {
  it("round-trips pinned evidence, links and the accused per case", () => {
    const s = mem();
    saveCaseMemory("c1", { pinned: ["r1"], links: { r1: "E2" }, accused: "E2" }, s);
    expect(loadCaseMemory("c1", s)).toEqual({ pinned: ["r1"], links: { r1: "E2" }, accused: "E2" });
    expect(loadCaseMemory("other", s)).toBeNull();
  });

  it("survives blocked or corrupted storage", () => {
    const blocked = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(() => saveCaseMemory("c1", { pinned: [], links: {} }, blocked)).not.toThrow();
    expect(loadCaseMemory("c1", blocked)).toBeNull();
    const s = mem();
    s.setItem("auditor.evidence.c1", "{broken");
    expect(loadCaseMemory("c1", s)).toBeNull();
  });
});

describe("restoreSnapshot", () => {
  it("makes the last result active and keeps only evidence that still exists", () => {
    const snap = restoreSnapshot(state(["r1", "r2"]), { pinned: ["r1", "gone"], links: { r1: "E2", gone: "E1" } });
    expect(snap.results.map((r) => r.result_id)).toEqual(["r1", "r2"]);
    expect(snap.activeResultId).toBe("r2");
    expect(snap.pinned).toEqual(["r1"]);
    expect(snap.links).toEqual({ r1: "E2" });
    expect(snap.verdict).toBeNull();
  });

  it("works with no memory and no results", () => {
    const snap = restoreSnapshot(state([]), null);
    expect(snap.activeResultId).toBeNull();
    expect(snap.pinned).toEqual([]);
  });
});
