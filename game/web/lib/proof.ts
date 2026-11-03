import type { Theory, ToolId, ToolResult } from "./types";

/** Each tool's default setting, as the server fills it in (auditor/tools/*.py). */
const DEFAULT_SETTING: Partial<Record<ToolId, string>> = { groupby: "weekday", zscore: "per_employee" };

export function settingOf(result: Pick<ToolResult, "tool_id" | "params">): string | null {
  const params = result.params as Record<string, unknown>;
  const value = params.by ?? params.scope ?? DEFAULT_SETTING[result.tool_id];
  return value === undefined ? null : String(value);
}

export function fits(result: Pick<ToolResult, "tool_id" | "params">, theory: Theory): boolean {
  return theory.fits.some((f) => f.tool === result.tool_id && (f.setting == null || f.setting === settingOf(result)));
}

/** Names the suspect and nobody else, or one other when two fraudsters share the ledger. */
const singlesOut = (r: ToolResult, suspectId: string, culprits: number) =>
  r.implicates.includes(suspectId) && r.implicates.length <= Math.max(1, culprits);

export type ProofLevel = "proven" | "lead" | "none";

/** Mirrors the server (auditor/career/proof.py): a clue that fits your theory and singles the
 *  accused out proves it, and so do two different tools that agree. Measured against the player's
 *  own theory, never the answer. */
export function proofOf(suspectId: string, theory: Theory | null, clues: ToolResult[], culprits = 1): ProofLevel {
  const naming = clues.filter((c) => singlesOut(c, suspectId, culprits));
  if ((theory && naming.some((c) => fits(c, theory))) || new Set(naming.map((c) => c.tool_id)).size >= 2) return "proven";
  return clues.some((c) => c.implicates.includes(suspectId)) ? "lead" : "none";
}

export type ToolRole = "proves" | "screens";

/** A tool PROVES when it fits some trick (one clue from it, naming one person, is proof); otherwise
 *  it SCREENS: it says who's unusual, not who's guilty. Pattern Matrix depends on what you group
 *  by. Matches THEORIES on the server (docs/CAREER.md §3.1). */
export function roleOf(tool: ToolId, setting?: string | null): ToolRole {
  switch (tool) {
    case "duplicates":
    case "benford":
    case "regression":
    case "iqr_box":
    case "timeseries":
    case "isoforest":
      return "proves";
    case "groupby":
      return setting === "vendor" || setting === "weekday" ? "proves" : "screens";
    default:
      return "screens"; // zscore, summary
  }
}

export const ROLE_LABEL: Record<ToolRole, string> = { proves: "PROVES", screens: "SCREENS" };
export const ROLE_STYLE: Record<ToolRole, string> = {
  proves: "border-green/70 text-green",
  screens: "border-amber/70 text-amber",
};

/** The kit as the Manual and the seniors' notes explain it: what each tool can prove. */
export const TOOL_KIT: { tool: ToolId; name: string; role: ToolRole; what: string }[] = [
  { tool: "summary", name: "Case Summary", role: "screens", what: "An overview. Never proof." },
  { tool: "groupby", name: "Pattern Matrix", role: "proves", what: "Proves by vendor (just under the limit) or by weekday (weekend payments). By category or hour it only screens." },
  { tool: "zscore", name: "Z-Score Scan", role: "screens", what: "Who's unusual, not who's guilty: right about half the time when it names one person." },
  { tool: "iqr_box", name: "Box & Whisker", role: "proves", what: "One monster invoice." },
  { tool: "duplicates", name: "Twin Finder", role: "proves", what: "Billed twice." },
  { tool: "benford", name: "Benford's Law", role: "proves", what: "Made-up receipts." },
  { tool: "timeseries", name: "Timeline", role: "proves", what: "Weekend payments. Sometimes flags a busy honest person: back it up." },
  { tool: "regression", name: "Margin Model", role: "proves", what: "Costs too big for the deal. Never trust it about the boss." },
  { tool: "isoforest", name: "Anomaly Hunter", role: "proves", what: "Made-up receipts, or claims just under the limit." },
];
