"use client";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

/** Charts for the /model site: plain SVG/HTML, paper surface, one hue on the main data,
 *  one axis, recessive grid, hover tooltips, and a table view under every chart. */

export const SERIES = ["var(--m-s1)", "var(--m-s2)", "var(--m-s3)", "var(--m-s4)", "var(--m-s5)", "var(--m-s6)"];

export function Figure({ title, note, children, table, wide = false }: { title: string; note?: ReactNode; children: ReactNode; table?: ReactNode; wide?: boolean }) {
  return (
    <figure className={`m-panel ${wide ? "lg:col-span-2" : ""}`}>
      <figcaption className="mb-4">
        <h2 className="m-h2">{title}</h2>
        {note && <p className="m-note">{note}</p>}
      </figcaption>
      {children}
      {table && (
        <details className="mt-3 text-sm text-[var(--m-ink-2)]">
          <summary className="cursor-pointer select-none">Show the numbers</summary>
          <div className="mt-2 max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}

export function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-left text-sm tabular-nums">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`py-1 font-normal text-[var(--m-ink-3)] ${i ? "pl-3 text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[var(--m-line)]">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 ${j ? "pl-3 text-right text-[var(--m-ink-2)]" : "text-[var(--m-ink)]"}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type BarRow = { label: string; value: number; highlight?: boolean; detail?: string };

/** Horizontal bars, largest first, each with its value in ink. `limit` folds a long list. */
export function BarList({
  rows,
  format,
  max,
  min = 0,
  sort = true,
  sortable = false,
  limit,
  itemLabel = "rows",
  wideValue = false,
}: {
  rows: BarRow[];
  format: (v: number) => string;
  max?: number;
  /** where the bars start (e.g. 0.5 for AUC, a coin flip); say so in the chart note */
  min?: number;
  /** false keeps the given order (years, stages) */
  sort?: boolean;
  /** show a control that flips highest-first to lowest-first */
  sortable?: boolean;
  limit?: number;
  itemLabel?: string;
  /** room for values like "3 years 7 months" on one line */
  wideValue?: boolean;
}) {
  const top = (max ?? Math.max(...rows.map((r) => r.value), 0) * 1.08) || 1;
  const [order, setOrder] = useState<"high" | "low">("high");
  const [all, setAll] = useState(false);
  const sorted = sort ? [...rows].sort((a, b) => (order === "high" ? b.value - a.value : a.value - b.value)) : rows;
  const shown = limit && !all ? sorted.slice(0, limit) : sorted;
  return (
    <div>
      {sortable && (
        <div className="mb-2 text-right">
          <button type="button" className="m-text-button" onClick={() => setOrder(order === "high" ? "low" : "high")}>
            {order === "high" ? "Highest first" : "Lowest first"}
          </button>
        </div>
      )}
      <ul role="list">
        {shown.map((r) => (
          <li key={r.label} className={`grid items-center gap-2 py-[5px] sm:gap-3 ${wideValue ? "grid-cols-[minmax(0,9rem)_minmax(0,1fr)_7.5rem] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_7.5rem]" : "grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3.5rem]"}`} title={r.detail ? `${r.label}: ${format(r.value)}, ${r.detail}` : `${r.label}: ${format(r.value)}`}>
            <span className="text-sm leading-snug [overflow-wrap:anywhere]">{r.label}</span>
            <span className="block h-3 rounded-r-[3px] bg-[var(--m-blue-100)]">
              <span className="block h-3 rounded-r-[3px]" style={{ width: `${Math.max(((r.value - min) / (top - min)) * 100, 0.5)}%`, background: r.highlight ? "var(--m-ink)" : "var(--m-tape)" }} />
            </span>
            <span className="text-right text-sm tabular-nums">{format(r.value)}</span>
          </li>
        ))}
      </ul>
      {limit && sorted.length > limit && (
        <button type="button" className="m-text-button mt-2" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${sorted.length} ${itemLabel}`}
        </button>
      )}
    </div>
  );
}

export type Series = { name: string; color: string; points: [number, number][]; dashed?: boolean };

/** Round axis steps (1, 2, 2.5 or 5 × a power of ten) covering 0…max. */
function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((v) => v >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Number(v.toPrecision(12)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Lines on one axis with a crosshair: hover anywhere to read every series at that x. */
export function LineChart({
  series,
  xFormat,
  yFormat,
  yMax,
  height = 260,
  width = 640,
  marker,
  xTicks: xTickValues,
}: {
  series: Series[];
  xFormat: (x: number) => string;
  yFormat: (y: number) => string;
  yMax?: number;
  height?: number;
  /** drawing width; use a smaller one for charts shown small, so text stays readable */
  width?: number;
  marker?: { x: number; label: string };
  /** where to put x labels (defaults to about seven of the data's x values) */
  xTicks?: number[];
}) {
  const id = useId();
  // draw at the real width, so the axis text stays 12px on a phone
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(width);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(280, boxW), H = W < 480 ? Math.round(height * 0.8) : height, L = 44, R = 18, T = 10, B = 28;
  const xs = useMemo(() => Array.from(new Set(series.flatMap((s) => s.points.map((p) => p[0])))).sort((a, b) => a - b), [series]);
  const [x0, x1] = [xs[0] ?? 0, xs[xs.length - 1] ?? 1];
  const ticks = yMax ? [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax) : niceTicks(Math.max(...series.flatMap((s) => s.points.map((p) => p[1]))));
  const top = ticks[ticks.length - 1];
  const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (y: number) => T + (1 - y / (top || 1)) * (H - T - B);
  const [hover, setHover] = useState<number | null>(null);
  const visibleSeries = series;
  const xTicks = xTickValues ?? (xs.length <= 8 ? xs : xs.filter((_, i) => i % Math.ceil(xs.length / 7) === 0));

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(sx(v) - x) < Math.abs(sx(xs[best]) - x)) best = i;
    });
    setHover(best);
  }

  const hx = hover === null ? null : xs[hover];
  return (
    <div className="relative" ref={box}>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--m-ink-2)]" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        role="img"
        aria-labelledby={`${id}-desc`}
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        <desc id={`${id}-desc`}>{series.map((s) => s.name).join(", ")}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="var(--m-line)" />
            <text x={L - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="var(--m-ink-3)">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - 8} textAnchor={sx(t) > W - R - 24 ? "end" : "middle"} fontSize="12" fill="var(--m-ink-3)">
            {xFormat(t)}
          </text>
        ))}
        {marker && (
          <g>
            <line x1={sx(marker.x)} x2={sx(marker.x)} y1={T} y2={H - B} stroke="var(--m-ink-3)" strokeDasharray="4 4" />
            <text x={sx(marker.x) + 6} y={T + 14} fontSize="12" fill="var(--m-ink-2)">
              {marker.label}
            </text>
          </g>
        )}
        {visibleSeries.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeDasharray={s.dashed ? "6 4" : undefined}
            strokeLinejoin="round"
            points={s.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ")}
          />
        ))}
        {hx !== null && (
          <g>
            <line x1={sx(hx)} x2={sx(hx)} y1={T} y2={H - B} stroke="var(--m-ink-3)" />
            {visibleSeries.map((s) => {
              const p = s.points.find((q) => q[0] === hx);
              return p ? <circle key={s.name} cx={sx(p[0])} cy={sy(p[1])} r="4" fill={s.color} stroke="var(--m-card)" strokeWidth="2" /> : null;
            })}
          </g>
        )}
      </svg>
      {hx !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-8 z-10 min-w-36 rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-2 py-1 text-xs"
          style={sx(hx) / W > 0.6 ? { right: `${(1 - sx(hx) / W) * 100 + 2}%` } : { left: `${(sx(hx) / W) * 100 + 2}%` }}
        >
          <div className="font-semibold text-[var(--m-ink)]">{xFormat(hx)}</div>
          {visibleSeries.map((s) => {
            const p = s.points.find((q) => q[0] === hx);
            return p ? (
              <div key={s.name} className="flex items-center justify-between gap-3 text-[var(--m-ink-2)]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="tabular-nums text-[var(--m-ink)]">{yFormat(p[1])}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

/** Predicted chance vs what happened; on the diagonal = honest probabilities. */
export function CalibrationChart({ points }: { points: { predicted: number; observed: number; cases: number }[] }) {
  const S = 300, P = 36;
  const s = (v: number) => P + v * (S - 2 * P);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="relative mx-auto max-w-sm">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="Calibration: predicted chance against observed share">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={s(0)} x2={s(1)} y1={S - s(t)} y2={S - s(t)} stroke="var(--m-line)" />
            <text x={s(0) - 4} y={S - s(t) + 4} textAnchor="end" fontSize="12" fill="var(--m-ink-3)">{`${t * 100}%`}</text>
            <text x={s(t)} y={S - P + 16} textAnchor="middle" fontSize="12" fill="var(--m-ink-3)">{`${t * 100}%`}</text>
          </g>
        ))}
        <line x1={s(0)} y1={S - s(0)} x2={s(1)} y2={S - s(1)} stroke="var(--m-ink-3)" strokeDasharray="4 4" />
        <polyline fill="none" stroke="var(--m-tape)" strokeWidth="2" points={points.map((p) => `${s(p.predicted)},${S - s(p.observed)}`).join(" ")} />
        {points.map((p, i) => (
          <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <circle cx={s(p.predicted)} cy={S - s(p.observed)} r="12" fill="transparent" />
            <circle cx={s(p.predicted)} cy={S - s(p.observed)} r="4.5" fill="var(--m-tape)" stroke="var(--m-card)" strokeWidth="2" />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div role="tooltip" className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-2 py-1 text-xs">
          predicted {Math.round(points[hover].predicted * 100)}% → happened {Math.round(points[hover].observed * 100)}% ({points[hover].cases.toLocaleString("en-IN")} cases)
        </div>
      )}
      <p className="mt-1 text-center text-xs text-[var(--m-ink-3)]">predicted chance (across) vs the share that really was over within a year (up)</p>
    </div>
  );
}
