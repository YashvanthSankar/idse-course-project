"use client";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";
import { useShake } from "./Shake";

const LABEL = { guilty: "GUILTY", wrong: "WRONG SUSPECT", closed: "CASE CLOSED" } as const;

/** A rubber stamp that slams onto the page with a thud and a screen shake. */
export function Stamp({ kind, onLand }: { kind: keyof typeof LABEL; onLand?: () => void }) {
  const reduced = useReducedEffects();
  const shake = useShake();
  const color = kind === "wrong" ? "var(--muted)" : "var(--red)";

  useEffect(() => {
    if (!reduced) return;
    sfx.play("stamp");
    onLand?.();
  }, [reduced, onLand]);

  return (
    <motion.div
      data-testid="verdict-stamp"
      initial={reduced ? false : { scale: 3.2, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      transition={{ type: "spring", stiffness: 520, damping: 22, mass: 1.1 }}
      onAnimationComplete={() => {
        if (reduced) return;
        sfx.play("stamp");
        shake(14);
        onLand?.();
      }}
      className="inline-block select-none rounded-md px-6 py-2 font-type text-5xl tracking-[0.2em] sm:text-7xl"
      style={{
        color,
        border: `6px double ${color}`,
        maskImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='s'><feTurbulence baseFrequency='0.06' numOctaves='3' seed='9'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.6'/></filter><rect width='100%' height='100%' filter='url(%23s)'/></svg>\")",
      }}
    >
      {LABEL[kind]}
    </motion.div>
  );
}
