// Pinned evidence and red-string links live only in the browser, so we keep a copy per case
// in sessionStorage. Together with GET /api/cases/{id}/state, a reload loses nothing.
import type { CaseSnapshot } from "./store";
import type { CaseState } from "./types";

type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };
export type CaseMemory = { pinned: string[]; links: Record<string, string>; accused?: string };

const key = (caseId: string) => `auditor.evidence.${caseId}`;

function session(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveCaseMemory(caseId: string, memory: CaseMemory, storage: KV | null = session()) {
  try {
    storage?.setItem(key(caseId), JSON.stringify(memory));
  } catch {
    // storage blocked: evidence just won't survive a reload
  }
}

export function loadCaseMemory(caseId: string, storage: KV | null = session()): CaseMemory | null {
  try {
    const raw = storage?.getItem(key(caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CaseMemory;
    return Array.isArray(parsed.pinned) && typeof parsed.links === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Server state + remembered evidence → a store snapshot (evidence for unknown results is dropped). */
export function restoreSnapshot(state: CaseState, memory: CaseMemory | null): CaseSnapshot {
  const ids = new Set(state.results.map((r) => r.result_id));
  const pinned = (memory?.pinned ?? []).filter((id) => ids.has(id));
  const links = Object.fromEntries(Object.entries(memory?.links ?? {}).filter(([id]) => ids.has(id)));
  return {
    meta: state.meta,
    results: state.results,
    activeResultId: state.results.at(-1)?.result_id ?? null,
    pinned,
    links,
    verdict: state.verdict ?? null,
  };
}
