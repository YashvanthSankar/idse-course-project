// Remembers which Class Mode room a case belongs to, so the verdict screen can send a
// phone player back to their classroom instead of the solo office.
type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

const key = (caseId: string) => `auditor.roomCase.${caseId}`;

function sessionStore(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberRoomCase(caseId: string, code: string, storage: KV | null = sessionStore()) {
  try {
    storage?.setItem(key(caseId), code);
  } catch {
    // storage blocked: the player just gets the normal office link
  }
}

export function roomForCase(caseId: string, storage: KV | null = sessionStore()): string | null {
  try {
    return storage?.getItem(key(caseId)) ?? null;
  } catch {
    return null;
  }
}
