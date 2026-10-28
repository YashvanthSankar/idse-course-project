// Only the browser session that created a class room may drive it (start/end rounds).
// The server hands out a host token with the room; we keep it for this tab session.
type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

const key = (code: string) => `auditor.host.${code}`;

function session(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveHostToken(code: string, token: string, storage: KV | null = session()) {
  try {
    storage?.setItem(key(code), token);
  } catch {
    // blocked storage: this tab simply can't host
  }
}

export function loadHostToken(code: string, storage: KV | null = session()): string | null {
  try {
    return storage?.getItem(key(code)) ?? null;
  } catch {
    return null;
  }
}
