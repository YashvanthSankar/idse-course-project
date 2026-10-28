"use client";
import { useState } from "react";
import { formatDuration } from "@/lib/format";
import { caseStartTime, useClock } from "@/lib/useClock";

export function CaseTimer({ caseId }: { caseId: string }) {
  const now = useClock();
  const [start] = useState(() => (typeof window === "undefined" ? 0 : caseStartTime(caseId)));
  const elapsed = now === null || start === 0 ? null : now - start;
  const late = elapsed !== null && elapsed >= 300;
  return (
    <div
      data-testid="case-timer"
      className={`flex items-center gap-1.5 font-mono text-sm tabular-nums ${late ? "text-amber" : "text-paper/80"}`}
      title="Time on this case — faster solves score a bonus"
    >
      <span aria-hidden>⏱</span>
      <span suppressHydrationWarning>{elapsed === null ? "--:--" : formatDuration(elapsed)}</span>
    </div>
  );
}
