"use client";
import { Stamp } from "@/components/fx/Stamp";

/** GUILTY for the right suspect, WRONG SUSPECT otherwise — slammed onto the case file. */
export function VerdictStamp({ correct, onLand }: { correct: boolean; onLand?: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <Stamp kind={correct ? "guilty" : "wrong"} onLand={onLand} />
    </div>
  );
}
