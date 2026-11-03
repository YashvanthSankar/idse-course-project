import { create } from "zustand";
import type { CareerVerdict, CaseMeta, ToolResult, Verdict } from "./types";

type CaseState = {
  meta: CaseMeta | null;
  results: ToolResult[];
  activeResultId: string | null;
  pinned: string[];
  links: Record<string, string>;
  verdict: Verdict | null;
  /** Career Mode's verdict: the rating, the contract so far, every culprit revealed. */
  careerVerdict: CareerVerdict | null;
  setMeta: (meta: CaseMeta) => void;
  setBudgetLeft: (budgetLeft: number) => void;
  addResult: (result: ToolResult) => void;
  setActive: (resultId: string | null) => void;
  pin: (resultId: string) => void;
  unpin: (resultId: string) => void;
  link: (resultId: string, suspectId: string) => void;
  unlink: (resultId: string) => void;
  evidenceFor: (suspectId: string) => string[];
  setVerdict: (verdict: Verdict) => void;
  setCareerVerdict: (verdict: CareerVerdict) => void;
  hydrate: (snapshot: CaseSnapshot) => void;
  reset: () => void;
};

/** A whole case at once — used to restore after a reload or a locked phone. */
export type CaseSnapshot = {
  meta: CaseMeta;
  results: ToolResult[];
  activeResultId: string | null;
  pinned: string[];
  links: Record<string, string>;
  verdict: Verdict | null;
  careerVerdict?: CareerVerdict | null;
};

const initial = {
  meta: null,
  results: [],
  activeResultId: null,
  pinned: [],
  links: {},
  verdict: null,
  careerVerdict: null,
};

export const useCaseStore = create<CaseState>()((set, get) => ({
  ...initial,
  setMeta: (meta) => set({ ...initial, meta }),
  setBudgetLeft: (budgetLeft) =>
    set((s) => (s.meta ? { meta: { ...s.meta, budget_left: budgetLeft } } : {})),
  addResult: (result) =>
    set((s) => ({
      results: s.results.some((r) => r.result_id === result.result_id)
        ? s.results
        : [...s.results, result],
      activeResultId: result.result_id,
    })),
  setActive: (activeResultId) => set({ activeResultId }),
  pin: (resultId) =>
    set((s) => (s.pinned.includes(resultId) ? {} : { pinned: [...s.pinned, resultId] })),
  unpin: (resultId) =>
    set((s) => {
      const links = { ...s.links };
      delete links[resultId];
      return { pinned: s.pinned.filter((id) => id !== resultId), links };
    }),
  link: (resultId, suspectId) =>
    set((s) => ({
      pinned: s.pinned.includes(resultId) ? s.pinned : [...s.pinned, resultId],
      links: { ...s.links, [resultId]: suspectId },
    })),
  unlink: (resultId) =>
    set((s) => {
      const links = { ...s.links };
      delete links[resultId];
      return { links };
    }),
  evidenceFor: (suspectId) =>
    get().pinned.filter((id) => get().links[id] === suspectId),
  setVerdict: (verdict) => set({ verdict }),
  setCareerVerdict: (careerVerdict) => set({ careerVerdict }),
  hydrate: (snapshot) => set({ careerVerdict: null, ...snapshot }),
  reset: () => set(initial),
}));
