import { create } from "zustand";
import { loadCaseMemory, saveCaseMemory } from "./caseMemory";

/** Who the player accused in each case (the Verdict itself only names the real fraudster). */
export const useAccused = create<{
  byCase: Record<string, string>;
  set: (caseId: string, suspectId: string) => void;
}>()((set) => ({
  byCase: {},
  set: (caseId, suspectId) => {
    const memory = loadCaseMemory(caseId) ?? { pinned: [], links: {} };
    saveCaseMemory(caseId, { ...memory, accused: suspectId }); // survives a verdict-page reload
    set((s) => ({ byCase: { ...s.byCase, [caseId]: suspectId } }));
  },
}));
