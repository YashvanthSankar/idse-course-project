"use client";
import { useSyncExternalStore } from "react";

/** Live `matchMedia` result; null during SSR so callers can avoid guessing. */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}
