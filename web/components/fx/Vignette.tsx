"use client";
import { usePathname } from "next/navigation";

/** Dark corners for mood, on the page's backdrop only: it sits under headers (z-10+), bars and
 *  pop-ups, so buttons and text in the corners are never shaded. Projector screens (/host) get
 *  an even lighter touch, to read from the back of a classroom. */
export function Vignette({ strength = 0.6 }: { strength?: number }) {
  const projector = usePathname()?.startsWith("/host") ?? false;
  const edge = projector ? Math.min(strength, 0.3) : strength;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[5]"
      style={{
        background: `radial-gradient(ellipse at center, transparent ${projector ? 60 : 50}%, rgb(0 0 0 / ${edge}) 100%)`,
      }}
    />
  );
}
