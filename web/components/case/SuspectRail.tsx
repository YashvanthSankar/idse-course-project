"use client";
import type { Suspect } from "@/lib/types";
import { SuspectCard } from "./SuspectCard";

export function SuspectRail({ suspects, flagged }: { suspects: Suspect[]; flagged: string[] }) {
  return (
    <section aria-label="Suspects" className="flex flex-col gap-2">
      <h2 className="px-1 font-type text-[10px] tracking-[0.4em] text-muted">SUSPECTS</h2>
      <ul className="flex flex-col gap-2">
        {suspects.map((s) => (
          <SuspectCard key={s.id} suspect={s} flagged={flagged.includes(s.id)} />
        ))}
      </ul>
    </section>
  );
}
