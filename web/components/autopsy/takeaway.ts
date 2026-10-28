// One big sentence per Autopsy slide, so the projector says the point out loud.
type Stats = Record<string, unknown>;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const pct = (v: unknown) => `${Math.round(num(v) * 100)}%`;
const p = (v: unknown) => Number(num(v).toPrecision(2)).toString();

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

export function takeaway(title: string, stats: Stats): string {
  switch (title) {
    case "The verdicts":
      return `${pct(stats.solve_rate)} caught the fraudster · median ${formatSeconds(num(stats.median_seconds))}`;
    case "Which tools did the class reach for?":
      return `${stats.most_used} was the go-to tool · ${stats.total_runs} runs in total`;
    case "How long did it take?":
      return `Right answers took ${formatSeconds(num(stats.median_right))} · wrong ones ${formatSeconds(num(stats.median_wrong))}`;
    case "Does more analysis pay off?": {
      const tail = `(r = ${num(stats.pearson_r).toFixed(2)}, p = ${p(stats.p_value)})`;
      return num(stats.pearson_r) > 0 && num(stats.p_value) < 0.05
        ? `Yes — more tools, more truth ${tail}`
        : `Not clearly — effort alone didn't decide it ${tail}`;
    }
    case "Which tool predicts success?":
      return `${stats.best_tool} separated winners from the rest (p = ${p(stats.best_p)})`;
    case "Detective archetypes": {
      const entries = Object.entries(stats).map(([k, v]) => [k, num(v)] as const);
      const total = entries.reduce((sum, [, v]) => sum + v, 0);
      const [top, count] = entries.sort((a, b) => b[1] - a[1])[0] ?? ["nobody", 0];
      return `Mostly ${top} — ${count} of ${total} detectives`;
    }
    default:
      return "Play a round first — then the class becomes the dataset.";
  }
}
