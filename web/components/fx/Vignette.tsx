"use client";
import { usePathname } from "next/navigation";

/** Dark corners for mood. Projector screens (/host) get a light touch: their main buttons sit
 *  in the corners and must read from the back of a classroom. */
export function Vignette({ strength = 0.75 }: { strength?: number }) {
  const projector = usePathname()?.startsWith("/host") ?? false;
  const edge = projector ? Math.min(strength, 0.3) : strength;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80]"
      style={{
        background: `radial-gradient(ellipse at center, transparent ${projector ? 60 : 45}%, rgb(0 0 0 / ${edge}) 100%)`,
      }}
    />
  );
}
