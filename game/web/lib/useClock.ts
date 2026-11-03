"use client";
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
};
const snapshot = () => Math.floor(Date.now() / 1000);

/** Current time in whole seconds, ticking once a second (null during SSR). */
export function useClock(): number | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

const START_PREFIX = "auditor.case.start.";

/** When this browser first opened the case (seconds), remembered across reloads. */
export function caseStartTime(caseId: string): number {
  const now = Math.floor(Date.now() / 1000);
  try {
    const raw = window.sessionStorage.getItem(START_PREFIX + caseId);
    if (raw) return Number(raw) || now;
    window.sessionStorage.setItem(START_PREFIX + caseId, String(now));
  } catch {
    // storage blocked: time from first render instead
  }
  return now;
}
