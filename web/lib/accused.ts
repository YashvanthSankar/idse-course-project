import { create } from "zustand";

/** Who the player accused in each case (the Verdict itself only names the real fraudster). */
export const useAccused = create<{
  byCase: Record<string, string>;
  set: (caseId: string, suspectId: string) => void;
}>()((set) => ({
  byCase: {},
  set: (caseId, suspectId) => set((s) => ({ byCase: { ...s.byCase, [caseId]: suspectId } })),
}));
