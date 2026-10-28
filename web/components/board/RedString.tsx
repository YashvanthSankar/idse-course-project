"use client";
import { motion } from "framer-motion";
import { useReducedEffects } from "@/lib/useReducedEffects";

export type Point = { x: number; y: number };

/** A cubic path that sags under its own weight: the longer the string, the deeper the sag. */
export function stringPath(a: Point, b: Point): string {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(110, dist * 0.18);
  const c1 = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 + sag };
  const c2 = { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 + sag };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

/** Red yarn from an evidence pin to a suspect pin, drawn on like someone stretching it. */
export function RedString({ from, to, id }: { from: Point; to: Point; id: string }) {
  const reduced = useReducedEffects();
  const d = stringPath(from, to);
  const draw = reduced ? false : { pathLength: 0 };
  return (
    <g data-string={id}>
      <motion.path d={d} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={4} strokeLinecap="round"
        transform="translate(2 4)" initial={draw} animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }} />
      <motion.path d={d} fill="none" stroke="#b3121f" strokeWidth={2.6} strokeLinecap="round"
        initial={draw} animate={{ pathLength: 1 }} transition={{ duration: 0.55, ease: "easeOut" }} />
      <motion.path d={d} fill="none" stroke="rgba(255,140,140,0.45)" strokeWidth={0.8}
        strokeDasharray="2 5" initial={draw} animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }} />
    </g>
  );
}

/** The brass-capped push pin at either end of a string. */
export function PinHead({ at }: { at: Point }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <circle r={6} fill="rgba(0,0,0,0.4)" cx={1.5} cy={2.5} />
      <circle r={5.5} fill="#c4161c" />
      <circle r={2} fill="#ff8a8a" cx={-1.6} cy={-1.6} />
    </g>
  );
}
