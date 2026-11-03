// Career Mode in the browser: which career this browser is playing (its code), plus formatting.
// The career itself lives on the server; the code lets the player continue on any device.
type KV = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem?: (k: string) => void };

const KEY = "auditor.career.v1";
const SEEN_KEY = "auditor.career.seen.v1";

/** Career Mode can be switched off for a demo with NEXT_PUBLIC_CAREER=0. */
export const CAREER_ENABLED = process.env.NEXT_PUBLIC_CAREER !== "0";

function storage(): KV | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadCareerCode(kv: KV | null = storage()): string | null {
  try {
    return kv?.getItem(KEY) || null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let memory: string | null = null; // when storage is blocked, the code lives for this tab

export function saveCareerCode(code: string | null, kv: KV | null = storage()): void {
  memory = code;
  try {
    if (code) kv?.setItem(KEY, code);
    else kv?.removeItem?.(KEY);
  } catch {
    // storage blocked: the player keeps the code on screen instead
  }
  listeners.forEach((cb) => cb());
}

// ---- React binding: read the stored code without a hydration mismatch ---------------
export function subscribeCareerCode(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** "" = no career yet (the server snapshot is `undefined`: not known until the client renders). */
export function careerCodeSnapshot(): string {
  return loadCareerCode() ?? memory ?? "";
}

/** "abc def" / "ABCDEF" / "abc-def" → "ABC-DEF" (the server is just as forgiving). */
export function normaliseCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 6 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

/** Salary is stored in lakh a year: 6 → "₹6 LPA", 150 → "₹1.5 Cr". */
export function formatSalary(lakh: number): string {
  if (lakh >= 100) {
    const crore = lakh / 100;
    return `₹${Number.isInteger(crore) ? crore : crore.toFixed(2).replace(/0$/, "")} Cr`;
  }
  return `₹${Number.isInteger(lakh) ? lakh : lakh.toFixed(2).replace(/\.?0+$/, "")} LPA`;
}

export const BAND_LABEL: Record<string, string> = {
  exceptional: "Exceptional",
  good: "Good",
  ok: "OK",
  bad: "Bad",
};

export const BAND_STYLE: Record<string, string> = {
  exceptional: "border-amber text-amber bg-amber/10",
  good: "border-green text-green bg-green/10",
  ok: "border-paper/40 text-paper/80 bg-white/5",
  bad: "border-red text-red bg-red/10",
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very hard",
};

/** Appraisals the player has already been shown (by "code:index"), so each pops up once. */
export function appraisalSeen(code: string, index: number, kv: KV | null = storage()): boolean {
  try {
    const seen = JSON.parse(kv?.getItem(SEEN_KEY) ?? "[]") as string[];
    return seen.includes(`${code}:${index}`);
  } catch {
    return false;
  }
}

export function markAppraisalSeen(code: string, index: number, kv: KV | null = storage()): void {
  try {
    const seen = JSON.parse(kv?.getItem(SEEN_KEY) ?? "[]") as string[];
    if (!seen.includes(`${code}:${index}`)) kv?.setItem(SEEN_KEY, JSON.stringify([...seen, `${code}:${index}`].slice(-200)));
  } catch {
    // storage blocked: the appraisal may show again, which is harmless
  }
}

/** The tools each tier unlocks (auditor/career/catalog.py). */
export const TIER_TOOLS: Record<string, string[]> = {
  small: ["summary", "groupby", "zscore", "iqr_box", "duplicates"],
  mid: ["summary", "groupby", "zscore", "iqr_box", "duplicates", "benford", "timeseries", "regression"],
  large: ["summary", "groupby", "zscore", "iqr_box", "duplicates", "benford", "timeseries", "regression", "isoforest"],
  very_large: ["summary", "groupby", "zscore", "iqr_box", "duplicates", "benford", "timeseries", "regression", "isoforest"],
  final: ["summary", "groupby", "zscore", "iqr_box", "duplicates", "benford", "timeseries", "regression", "isoforest"],
};
