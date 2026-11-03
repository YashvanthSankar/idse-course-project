"use client";
import { useReducedMotion } from "framer-motion";
import { useSettings } from "./settings";

/** True when the OS asks for reduced motion or the player turned effects down. */
export function useReducedEffects(): boolean {
  const osReduced = useReducedMotion();
  const reduceEffects = useSettings((s) => s.reduceEffects);
  return Boolean(osReduced) || reduceEffects;
}
