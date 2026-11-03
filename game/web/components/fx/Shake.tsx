"use client";
import { useAnimate } from "framer-motion";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useReducedEffects } from "@/lib/useReducedEffects";

const ShakeContext = createContext<(intensity?: number) => void>(() => {});

/** Wraps the app so any component can shake the whole screen. It nudges the page with relative
 *  left/top offsets, not a transform: a transformed wrapper would trap every position:fixed
 *  element inside it (tab bars, lamps, overlays) for the length of the shake. */
export function ShakeProvider({ children }: { children: ReactNode }) {
  const [scope, animate] = useAnimate();
  const reduced = useReducedEffects();
  const shake = useCallback(
    (intensity = 10) => {
      if (reduced || !scope.current) return;
      const i = intensity;
      void animate(
        scope.current,
        { left: [0, -i, i * 0.8, -i * 0.6, i * 0.4, -i * 0.2, 0], top: [0, i * 0.4, -i * 0.3, i * 0.2, 0, 0, 0] },
        { duration: 0.45, ease: "easeOut" },
      );
    },
    [animate, reduced, scope],
  );
  return (
    <ShakeContext.Provider value={shake}>
      <div ref={scope} className="relative min-h-dvh">
        {children}
      </div>
    </ShakeContext.Provider>
  );
}

export const useShake = () => useContext(ShakeContext);
