"use client";
import { useMemo, useSyncExternalStore } from "react";
import { EMPTY_PROGRESS, loadProgress, type Progress } from "./progress";

const PROGRESS_KEY = "auditor.progress.v1";

// Progress lives in localStorage; read it as an external store so SSR renders the
// empty state and the client switches to the saved one without a hydration mismatch.
function readProgressRaw(): string | null {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
}

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

export function useProgress(): Progress {
  const raw = useSyncExternalStore(subscribeStorage, readProgressRaw, () => null);
  return useMemo(
    () => (raw ? loadProgress({ getItem: () => raw, setItem: () => {} }) : EMPTY_PROGRESS),
    [raw],
  );
}
