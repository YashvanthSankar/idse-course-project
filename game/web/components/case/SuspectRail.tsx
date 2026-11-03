"use client";
import type { Suspect } from "@/lib/types";
import { SuspectCard } from "./SuspectCard";

export function SuspectRail({ caseId, suspects, flagged, flaggedBy }: {
  caseId: string;
  suspects: Suspect[];
  flagged: string[];
  flaggedBy?: string;
}) {
  return (
    <section aria-label="Suspects" className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-xl italic text-paper">Suspects</h2>
      <p className="px-1 text-[13px] text-paper/55">Question them — then check their story against the data.</p>
      <ul className="flex flex-col gap-1">
        {suspects.map((s) => (
          <SuspectCard key={s.id} caseId={caseId} suspect={s} flagged={flagged.includes(s.id)} flaggedBy={flaggedBy} />
        ))}
      </ul>
    </section>
  );
}
