import { beforeEach, describe, expect, it } from "vitest";
import { useCaseStore } from "./store";
import type { ToolResult, Verdict } from "./types";

const result = (id: string): ToolResult =>
  ({ result_id: id, tool_id: "zscore", implicates: ["E2"] }) as unknown as ToolResult;

describe("useCaseStore", () => {
  beforeEach(() => useCaseStore.getState().reset());

  it("addResult stores the result and makes it active", () => {
    useCaseStore.getState().addResult(result("r1"));
    const s = useCaseStore.getState();
    expect(s.results.map((r) => r.result_id)).toEqual(["r1"]);
    expect(s.activeResultId).toBe("r1");
  });

  it("addResult with a cached id does not duplicate", () => {
    useCaseStore.getState().addResult(result("r1"));
    useCaseStore.getState().addResult(result("r1"));
    expect(useCaseStore.getState().results).toHaveLength(1);
  });

  it("link then evidenceFor returns ids", () => {
    const st = useCaseStore.getState();
    st.pin("r1");
    st.pin("r2");
    st.link("r1", "E2");
    st.link("r2", "E2");
    expect(useCaseStore.getState().evidenceFor("E2")).toEqual(["r1", "r2"]);
  });

  it("link pins the result if it was not pinned", () => {
    useCaseStore.getState().link("r9", "E1");
    expect(useCaseStore.getState().pinned).toContain("r9");
  });

  it("unpin also removes link", () => {
    const st = useCaseStore.getState();
    st.pin("r1");
    st.link("r1", "E3");
    st.unpin("r1");
    const s = useCaseStore.getState();
    expect(s.pinned).toEqual([]);
    expect(s.evidenceFor("E3")).toEqual([]);
  });

  it("relinking moves evidence to the new suspect", () => {
    const st = useCaseStore.getState();
    st.link("r1", "E1");
    st.link("r1", "E4");
    expect(useCaseStore.getState().evidenceFor("E1")).toEqual([]);
    expect(useCaseStore.getState().evidenceFor("E4")).toEqual(["r1"]);
  });

  it("reset clears verdict", () => {
    useCaseStore.getState().setVerdict({ correct: true } as Verdict);
    useCaseStore.getState().reset();
    expect(useCaseStore.getState().verdict).toBeNull();
  });
});

describe("hydrate", () => {
  it("restores a whole case in one step", () => {
    const st = useCaseStore.getState();
    st.reset();
    st.hydrate({
      meta: { case_id: "c9" } as never,
      results: [result("a"), result("b")],
      activeResultId: "b",
      pinned: ["a"],
      links: { a: "E1" },
      verdict: null,
    });
    const s = useCaseStore.getState();
    expect(s.meta?.case_id).toBe("c9");
    expect(s.results).toHaveLength(2);
    expect(s.activeResultId).toBe("b");
    expect(s.evidenceFor("E1")).toEqual(["a"]);
  });
});
