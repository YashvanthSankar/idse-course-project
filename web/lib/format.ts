const inr = (digits: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatINR(value: number, digits = 0): string {
  return `₹${inr(digits).format(value)}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function formatStat(key: string, value: number | string): string {
  if (typeof value === "string") return value.replace(/_/g, " ");
  if (/(^|_)p(_|$)/.test(key) || key.startsWith("p_")) {
    return value !== 0 && Math.abs(value) < 0.001 ? value.toExponential(1) : value.toFixed(3);
  }
  if (key.includes("share")) return `${(value * 100).toFixed(1)}%`;
  if (Number.isInteger(value)) return new Intl.NumberFormat("en-IN").format(value);
  return Math.abs(value) >= 100 ? new Intl.NumberFormat("en-IN").format(Math.round(value)) : value.toFixed(3);
}

/** The few stats worth showing on the result card: ones about implicated suspects first. */
export function keyStats(
  stats: Record<string, number | string>,
  implicates: string[],
  max = 4,
): [string, number | string][] {
  const entries = Object.entries(stats);
  const about = (k: string) => implicates.some((id) => k.endsWith(`_${id}`));
  const first = entries.filter(([k]) => about(k));
  const general = entries.filter(([k]) => !/_E\d+$/.test(k));
  const rest = entries.filter(([k]) => !about(k) && /_E\d+$/.test(k));
  return [...first, ...general, ...rest].slice(0, max);
}

/** "p_E4" -> "p", "weekend_share_E2" -> "weekend share" (the suspect is shown separately). */
export function statLabel(key: string): { label: string; suspect: string | null } {
  const m = key.match(/^(.*)_(E\d+)$/);
  return m ? { label: m[1].replace(/_/g, " "), suspect: m[2] } : { label: key.replace(/_/g, " "), suspect: null };
}

/** "Flagged: E4." -> "Flagged: Aditya." for the suspects we know. */
export function withNames(text: string, names: Record<string, string>): string {
  return text.replace(/\bE\d+\b/g, (id) => names[id]?.split(" ")[0] ?? id);
}
