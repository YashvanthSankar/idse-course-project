"use client";
import type { Suspect } from "@/lib/types";
import { SuspectCard } from "./SuspectCard";

export function SuspectRail({ suspects, flagged, flaggedBy }: {
  suspects: Suspect[];
  flagged: string[];
  flaggedBy?: string;
}) {
  return (
    <section aria-label="Suspects" className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-xl italic text-paper">Suspects</h2>
      <ul className="flex flex-col gap-1">
        {suspects.map((s) => (
          <SuspectCard key={s.id} suspect={s} flagged={flagged.includes(s.id)} flaggedBy={flaggedBy} />
        ))}
      </ul>
    </section>
  );
}
