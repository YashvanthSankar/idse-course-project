// Who am I in Class Mode? A stable id per browser so a locked phone can rejoin.
type Me = { id: string; name: string };
const KEY = "auditor.player.v1";
let memory: Me | null = null;

function randomId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function loadPlayer(): Me {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const me = JSON.parse(raw) as Me;
      if (me.id) return me;
    }
  } catch {
    // storage blocked: fall back to memory
  }
  memory ??= { id: randomId(), name: "" };
  savePlayer(memory);
  return memory;
}

export function savePlayer(me: Me): void {
  memory = me;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    // private mode: the id lives for this tab only
  }
}

export const MAX_NAME = 16;

// ---- React binding: read the stored player without a hydration mismatch ----------
const listeners = new Set<() => void>();

function rawSnapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return memory ? JSON.stringify(memory) : "";
  }
}

export function subscribePlayer(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPlayerSnapshot(): string {
  return rawSnapshot();
}

export function setPlayerName(name: string): Me {
  const me = { ...loadPlayer(), name: name.trim().slice(0, MAX_NAME) };
  savePlayer(me);
  listeners.forEach((cb) => cb());
  return me;
}
