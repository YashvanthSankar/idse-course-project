"use client";
import { cn } from "@/lib/cn";



/** 1 Investigate · 2 Pin 2 clues · 3 Accuse — highlights where the player is. */
export function StepGuide({ results, pinned, clues = 2, broke = false }: { results: number; pinned: number; clues?: number; broke?: boolean }) {
  const STEPS = ["Investigate", `Pin ${clues} clue${clues === 1 ? "" : "s"}`, "Accuse"];
  // out of budget: nothing left to investigate, so the next step is the accusation
  const current = broke ? 2 : results === 0 ? 0 : pinned < clues ? 1 : 2;
  return (
    <ol data-testid="step-guide" aria-label="Your progress" className="flex items-center gap-1 text-[13px]">
      {STEPS.map((label, i) => {
        // out of budget skips "pin" without doing it: no tick for a step that wasn't done
        const done = i < current && !(broke && i === 1 && pinned < clues);
        const now = i === current;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden className={cn("mx-1 h-px w-5", done || now ? "bg-amber/50" : "bg-line")} />}
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                done ? "bg-green/20 text-green" : now ? "bg-amber text-ink-950" : "bg-ink-800 text-paper/45",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cn("whitespace-nowrap", now ? "text-paper" : done ? "text-paper/60" : "text-paper/40")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
