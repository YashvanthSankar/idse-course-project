"use client";
import { Stamp } from "@/components/fx/Stamp";

/** GUILTY for the right suspect, WRONG SUSPECT otherwise — slammed onto the case file. It lands in
 *  the bottom corner and prints like ink (multiply), so the accused's name stays readable. */
export function VerdictStamp({ correct, onLand }: { correct: boolean; onLand?: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-end p-2 mix-blend-multiply sm:p-5">
      <div className="origin-bottom-right scale-[0.6] sm:scale-[0.8]">
        <Stamp kind={correct ? "guilty" : "wrong"} onLand={onLand} />
      </div>
    </div>
  );
}
