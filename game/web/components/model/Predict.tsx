"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { duration, getOptions, getSample, MONTHS, pct, predict, type Effect, type Kind, type Prediction, type Sample } from "@/lib/model";
import { LineChart } from "./Charts";

const EXAMPLES = [
  { title: "Cheque bounce", district: "Chennai" },
  { title: "Accident compensation claim", district: "Madurai" },
  { title: "Divorce", district: "Coimbatore" },
  { title: "Theft", district: "Kancheepuram" },
  { title: "Drunk driving", district: "Salem" },
  { title: "Anticipatory bail", district: "Tiruchirappalli" },
];

const select =
  "w-full rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-3 py-2 text-sm text-[var(--m-ink)] focus:outline-2 focus:outline-[var(--m-s1)]";

function kindLabel(k: Kind) {
  return `${k.title} — ${k.case_type_name.split(" (")[0]} · ${k.court_level}`;
}

export function Predict() {
  const options = useQuery({ queryKey: ["model-options"], queryFn: getOptions, staleTime: Infinity });
  const kinds = options.data?.kinds ?? [];
  const [district, setDistrict] = useState("Chennai");
  const [kindId, setKindId] = useState<string | null>(null);
  const [month, setMonth] = useState(6);
  const [compareWith, setCompareWith] = useState("");
  const kind = kindId ?? kinds.find((k) => k.title === "Cheque bounce")?.id ?? kinds[0]?.id ?? null;

  const result = useQuery({
    queryKey: ["model-predict", district, kind, month],
    queryFn: () => predict(district, kind!, month),
    enabled: !!kind,
  });
  const compare = useQuery({
    queryKey: ["model-predict", compareWith, kind, month],
    queryFn: () => predict(compareWith, kind!, month),
    enabled: !!kind && !!compareWith,
  });

  if (options.isError) return <p className="text-[var(--m-critical)]">Couldn&apos;t reach the model. Try again in a minute.</p>;
  if (!options.data) return <p className="text-[var(--m-ink-2)]">Loading the model…</p>;
  const opts = options.data;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Will a case be disposed of within a year?</h1>
        <p className="mt-1 max-w-3xl text-[var(--m-ink-2)]">
          Pick a district and a kind of case. The model was trained on Tamil Nadu district-court cases filed in 2015–2016 and tested on{" "}
          {opts.test.n.toLocaleString("en-IN")} cases filed in 2017 that it had never seen.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
          {EXAMPLES.map((ex) => {
            const k = kinds.find((x) => x.title === ex.title);
            if (!k) return null;
            return (
              <button
                key={ex.title}
                type="button"
                onClick={() => {
                  setKindId(k.id);
                  setDistrict(ex.district);
                }}
                className="rounded-full border border-[var(--m-line)] bg-[var(--m-card)] px-3 py-1 text-sm text-[var(--m-ink)] hover:border-[var(--m-s1)]"
              >
                {ex.title} · {ex.district}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-4 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Kind of case</span>
          <select className={select} value={kind ?? ""} onChange={(e) => setKindId(e.target.value)} data-testid="model-kind">
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[var(--m-ink-3)]">
            The {kinds.length} most common real kinds of case, covering {pct(opts.kinds_cover_2017)} of 2017 filings.
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">District</span>
          <select className={select} value={district} onChange={(e) => setDistrict(e.target.value)} data-testid="model-district">
            {opts.districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Month filed</span>
          <select className={select} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </section>

      {result.isError && <p className="text-[var(--m-critical)]">{(result.error as Error).message}</p>}
      {result.data && (
        <Result
          r={result.data}
          compare={compare.data}
          compareWith={compareWith}
          setCompareWith={setCompareWith}
          districts={opts.districts}
        />
      )}

      <RealCase test={opts.test} />

      <p className="rounded-lg bg-[var(--m-blue-100)] px-4 py-3 text-sm text-[var(--m-ink)]">{opts.notice}</p>
    </div>
  );
}

function outOfTen(p: number) {
  return Math.round(p * 10);
}

function Result({
  r,
  compare,
  compareWith,
  setCompareWith,
  districts,
}: {
  r: Prediction;
  compare?: Prediction;
  compareWith: string;
  setCompareWith: (d: string) => void;
  districts: string[];
}) {
  const curve = r.still_open;
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]" aria-live="polite">
      <div className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
        <p className="text-sm text-[var(--m-ink-2)]">
          {r.kind.title} · {r.kind.court_level} · {r.district}
        </p>
        <p className="mt-2 text-5xl font-bold tabular-nums" data-testid="model-probability">
          {pct(r.probability)}
        </p>
        <p className="mt-1 text-[var(--m-ink)]">
          chance of being disposed of within a year. Out of 10 cases like this, about <b>{outOfTen(r.probability)}</b> would be.
        </p>
        <p className="mt-3 text-sm text-[var(--m-ink-2)]">
          Across Tamil Nadu, {r.kind.cases_2017.toLocaleString("en-IN")} cases of this kind were filed in 2017;{" "}
          {pct(r.kind.within_1y_2017)} were disposed of within a year.
        </p>
        {r.court && (
          <p className="mt-2 text-sm text-[var(--m-ink-2)]">
            At the end of the data ({r.court.cutoff}), {r.district}&apos;s {r.kind.court_level.toLowerCase()}s had{" "}
            {r.court.pending.toLocaleString("en-IN")} cases waiting and had disposed of {r.court.disposed_last_year.toLocaleString("en-IN")} in
            the year before.
          </p>
        )}
        {!r.court_found && (
          <p className="mt-2 text-sm text-[var(--m-critical)]">
            {r.district} has no {r.kind.court_level.toLowerCase()} in the data, so Tamil Nadu&apos;s typical court workload was used.
          </p>
        )}

        <div className="mt-4 border-t border-[var(--m-line)] pt-3">
          <label className="text-sm">
            <span className="mr-2 text-[var(--m-ink-2)]">Compare with another district:</span>
            <select className="rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-2 py-1 text-sm" value={compareWith} onChange={(e) => setCompareWith(e.target.value)} data-testid="model-compare">
              <option value="">choose…</option>
              {districts
                .filter((d) => d !== r.district)
                .map((d) => (
                  <option key={d}>{d}</option>
                ))}
            </select>
          </label>
          {compare && compareWith && (
            <p className="mt-2 text-sm" data-testid="model-compare-result">
              Same case in <b>{compare.district}</b>: <b>{pct(compare.probability)}</b> ({compare.probability >= r.probability ? "+" : ""}
              {Math.round((compare.probability - r.probability) * 100)} points)
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
          <h2 className="text-sm font-semibold">What moved the estimate</h2>
          <p className="mb-3 text-xs text-[var(--m-ink-3)]">Compared with an average 2017 case. Blue to the right: faster. Red to the left: slower.</p>
          <Effects effects={r.effects} caseTypeName={r.kind.case_type_name.split(" (")[0]} />
          <p className="mt-3 text-xs text-[var(--m-ink-3)]">
            The kind of case matters most. Between cases of the same kind, the model can only roughly tell which will be quicker.
          </p>
        </div>
        {curve && (
          <div className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
            <h2 className="text-sm font-semibold">Still open after N months: {curve.label.split(" (")[0].toLowerCase()}s in Tamil Nadu</h2>
            <p className="mb-2 text-xs text-[var(--m-ink-3)]">
              All such cases filed 2015–2018 (Kaplan–Meier).
              {curve.median_days ? ` Half had ended after ${duration(curve.median_days)}.` : " Fewer than half had ended by the end of the data."}
            </p>
            <LineChart
              height={230}
              width={420}
              series={[{ name: curve.label, color: "var(--m-s1)", points: Object.entries(curve.months).map(([m, v]) => [Number(m), v]) }]}
              xFormat={(m) => `${m} m`}
              yFormat={(v) => pct(v)}
              yMax={1}
            />
          </div>
        )}
      </div>
    </section>
  );
}

const SHORT: Record<string, string> = {
  log_prev_year_filings: "Similar cases last year",
  log_pending_at_filing: "Cases already waiting",
  clearance_last_year: "How fast courts cleared cases",
  n_ipc_sections: "IPC sections charged",
};

/** "Section: s.138", "Case type: Calendar case", not the full stored value. */
function shortLabel(e: Effect, caseTypeName?: string): string {
  if (SHORT[e.input]) return SHORT[e.input];
  const value = e.value ?? "";
  if (e.input === "law_section") return `Section: ${value.includes(" s.") ? `s.${value.split(" s.")[1]}` : "other"}`;
  if (e.input === "case_type") return `Case type: ${caseTypeName ?? value.toUpperCase()}`;
  if (e.input === "filing_month") return `Month: ${MONTHS[Number(value) - 1] ?? value}`;
  if (e.input === "law") return `Law: ${value.replace(" (state liquor laws)", "")}`;
  return `${e.label}: ${value}`;
}

function Effects({ effects, caseTypeName }: { effects: Effect[]; caseTypeName: string }) {
  const max = Math.max(...effects.map((e) => Math.abs(e.effect)), 0.01);
  return (
    <ul className="space-y-[2px]">
      {effects.map((e) => {
        const w = (Math.abs(e.effect) / max) * 50;
        return (
          <li key={e.input} className="group relative grid grid-cols-[minmax(9rem,15rem)_1fr] items-center gap-2 py-[3px] text-sm">
            <span className="truncate text-[var(--m-ink-2)]" title={`${e.label}${e.value ? `: ${e.value}` : ""}`}>
              {shortLabel(e, caseTypeName)}
            </span>
            <span className="relative h-4">
              <span className="absolute left-1/2 top-0 h-4 w-px bg-[var(--m-line)]" />
              <span
                className={`absolute top-0 h-4 ${e.effect >= 0 ? "rounded-r-[4px]" : "rounded-l-[4px]"}`}
                style={{
                  width: `${w}%`,
                  left: e.effect >= 0 ? "50%" : `${50 - w}%`,
                  background: e.effect >= 0 ? "var(--m-s1)" : "var(--m-red)",
                }}
              />
            </span>
            <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 hidden rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-2 py-1 text-xs shadow-sm group-hover:block">
              {e.effect >= 0 ? "faster" : "slower"} than average · {e.effect >= 0 ? "+" : ""}
              {e.effect.toFixed(2)} log-odds
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RealCase({ test }: { test: { n: number; accuracy: number } }) {
  const [tally, setTally] = useState({ checked: 0, right: 0 });
  const [last, setLast] = useState<Sample | null>(null);
  const draw = useMutation({
    mutationFn: getSample,
    onSuccess: (s) => {
      setLast(s);
      setTally((t) => ({ checked: t.checked + 1, right: t.right + Number(s.probability >= 0.5 === s.actual.within_1y) }));
    },
  });
  const verdict = useMemo(() => {
    if (!last) return null;
    const a = last.actual;
    const when = a.observed_days === 0 ? "on the day it was filed" : `after ${duration(a.observed_days)}`;
    if (a.ended) return `It was disposed of ${when}${a.within_1y ? ", within a year" : ", so not within a year"}.`;
    return `It was still open after ${duration(a.observed_days)}, so not within a year.`;
  }, [last]);
  return (
    <section className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="font-semibold">Test it on a real past case</h2>
          <p className="text-sm text-[var(--m-ink-2)]">A random 2017 case the model never saw. You see what it predicted, then what really happened.</p>
        </div>
        <button
          type="button"
          onClick={() => draw.mutate()}
          disabled={draw.isPending}
          className="rounded-md bg-[var(--m-s1)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          data-testid="model-sample"
        >
          {last ? "Show me another" : "Show me a real case"}
        </button>
      </div>
      {last && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="model-sample-result">
          <div className="rounded-lg bg-[var(--m-surface)] p-3 text-sm">
            <p className="font-medium">
              {last.case.title} · {last.case.court_level}
            </p>
            <p className="text-[var(--m-ink-2)]">
              {last.case.district} · filed {last.case.filed}
            </p>
            <p className="mt-2">
              The model said: <b>{pct(last.probability)}</b> chance within a year.
            </p>
          </div>
          <div className="rounded-lg bg-[var(--m-surface)] p-3 text-sm">
            <p>{verdict}</p>
            <p className={`mt-2 font-medium ${last.probability >= 0.5 === last.actual.within_1y ? "text-[var(--m-good)]" : "text-[var(--m-critical)]"}`}>
              {last.probability >= 0.5 === last.actual.within_1y ? "✓ The model's lean was right" : "✗ The model's lean was wrong"}
            </p>
            <p className="mt-1 text-xs text-[var(--m-ink-3)]">
              This visit: right on {tally.right} of {tally.checked}. On all {test.n.toLocaleString("en-IN")} test cases its lean is right{" "}
              {pct(test.accuracy)} of the time.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
