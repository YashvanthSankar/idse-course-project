type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

/** The "what's on this site" guide opens once, on a visitor's first page; they can reopen it. */
export const GUIDE_KEY = "site.guide.v1";

export function guideSeen(storage: KV | null): boolean {
  try {
    return !storage || storage.getItem(GUIDE_KEY) === "1";
  } catch {
    return true; // blocked storage: don't nag on every page
  }
}

export function markGuideSeen(storage: KV | null): void {
  try {
    storage?.setItem(GUIDE_KEY, "1");
  } catch {
    // Private mode or blocked storage: the guide may open again next visit.
  }
}

export function browserStorage(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
