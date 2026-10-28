import type { ToolResult } from "./types";

/** Two clues per accusation — unless the budget is spent, then every clue you have (max 2).
 *  Mirrors the server rule in the accuse route. */
export function requiredClues(budgetLeft: number, resultCount: number): number {
  return budgetLeft > 0 ? 2 : Math.min(2, resultCount);
}

export type ClueWarning = { tone: "bad" | "weak"; text: string };

/** What the player can already see about a clue's value (never reveals the answer). */
export function clueWarning(
  result: ToolResult,
  suspectId: string,
  nameOf: (id: string) => string,
): ClueWarning | null {
  if (!result.implicates.includes(suspectId)) {
    return { tone: "bad", text: `Doesn't point at ${nameOf(suspectId)} · −100` };
  }
  if (result.implicates.length > 2) {
    return { tone: "weak", text: `Points at ${result.implicates.length} people · weak` };
  }
  return null;
}

/** Pre-select the sharpest clues: ones that point at the accused, and at as few others as possible. */
export function defaultPick(evidence: ToolResult[], suspectId: string, count: number): string[] {
  const rank = (r: ToolResult) =>
    r.implicates.includes(suspectId) ? r.implicates.length : 100 + r.implicates.length;
  return [...evidence]
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .slice(0, count)
    .map(({ r }) => r.result_id);
}
