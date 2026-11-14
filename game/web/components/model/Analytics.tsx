"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import resultsJson from "@/public/pipeline/results.json";
import { duration, getAnalytics, outOf10, pct, type Analytics as Data } from "@/lib/model";
import { BarList, Figure, LineChart, SERIES, Table } from "./Charts";

/** "Data analysis": what the records show, one question per panel. */

type Score = { auc: number; accuracy: number; top_decile_precision: number };
type Target = { base_rate: number; always_guessing_accuracy: number; lookup_case_type: Score; lookup_case_type_and_law: Score; logistic_regression: Score };
const SETTLEMENT = (resultsJson as unknown as {
  settlement: {
    horizon_days: number;
    train_year: number;
    test_year: number;
    targets: { dismissed: Target; settled: Target };
    finished_cases_only_dismissed: { accuracy: number; always_guessing_accuracy: number };
    by_case_type: { name: string; cases: number; dismissed: number; settled: number }[];
    within_case_type: Record<string, { name: string; n: number; settled: { auc: number } }>;
    criminal_calendar_by_law: { law: string; cases: number; settled: number }[];
  };
}).settlement;

const CURVES: [string, string][] = [
  ["stc", "Quick summary trials"],
  ["hmop", "Marriage petitions"],
  ["os", "Civil suits"],
  ["mcop", "Accident claims"],
  ["cc", "Full criminal trials"],
];
const shortName = (s: string) => s.split(" (")[0];

export function Analytics() {
  const q = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity });
  if (q.isError) return <p className="m-wrap m-page text-[var(--m-critical)]">Couldn&apos;t load this page. Please reload in a minute.</p>;
  if (!q.data) return <p className="m-wrap m-page text-[var(--m-ink-2)]">Loading…</p>;
  return <Stories a={q.data} />;
}

function HowDisputesEnd() {
  const S = SETTLEMENT;
  const { dismissed: d, settled: s } = S.targets;
  const trap = S.finished_cases_only_dismissed;
  const cheque = S.criminal_calendar_by_law.find((l) => l.law === "Negotiable Instruments Act");
  const ipc = S.criminal_calendar_by_law.find((l) => l.law === "Indian Penal Code");
  return (
    <Figure
      wide
      title="5. How disputes end: settled or dismissed"
      note={`Real disputes, each watched for two full years. Settled means a compromise, Lok Adalat, withdrawal or compounding. Logistic regression trained on ${S.train_year} filings, tested on ${S.test_year}.`}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Table head={["Kind of case", "Dismissed", "Settled"]} rows={S.by_case_type.map((r) => [shortName(r.name), pct(r.dismissed, 1), pct(r.settled, 1)])} />
          {cheque && ipc && (
            <p className="mt-3 text-[15px]">
              Inside magistrate trials, <b className="font-semibold">{pct(cheque.settled, 1)}</b> of cheque-bounce cases settle, against <b className="font-semibold">{pct(ipc.settled, 1)}</b> of Indian Penal Code cases.
            </p>
          )}
        </div>
        <div>
          <Table
            head={["Can filing-day facts tell?", "Dismissed", "Settled"]}
            rows={[
              ["Share that end this way", pct(d.base_rate, 1), pct(s.base_rate, 1)],
              ["Always guessing: accuracy", pct(d.always_guessing_accuracy, 1), pct(s.always_guessing_accuracy, 1)],
              ["Model: accuracy", pct(d.logistic_regression.accuracy, 1), pct(s.logistic_regression.accuracy, 1)],
              ["Lookup by case type: AUC", d.lookup_case_type.auc.toFixed(3), s.lookup_case_type.auc.toFixed(3)],
              ["Lookup by case type and law: AUC", d.lookup_case_type_and_law.auc.toFixed(3), s.lookup_case_type_and_law.auc.toFixed(3)],
              ["Model: AUC", d.logistic_regression.auc.toFixed(3), s.logistic_regression.auc.toFixed(3)],
              ["Model's top 10%: share that really end this way", pct(d.logistic_regression.top_decile_precision, 1), pct(s.logistic_regression.top_decile_precision, 1)],
            ]}
          />
          <p className="m-note mt-3">
            Dismissal is mostly the kind of case, so the model adds little. Settlement can be ranked but stays rare. Scoring only cases that had already ended would have claimed {pct(trap.accuracy, 1)} against {pct(trap.always_guessing_accuracy, 1)}, but on filing day nobody knows which cases those will be.
          </p>
        </div>
      </div>
    </Figure>
  );
}

function Stories({ a }: { a: Data }) {
  const [search, setSearch] = useState("");
  const tn = a.tamil_nadu;
  const h = a.difficulty;
  const stage = h.stages.contested;
  const districts = tn.within_1y_by_district.filter((d) => d.district.toLowerCase().includes(search.toLowerCase()));
  const all = tn.still_open_curves["all cases"];
  const served = a.model.test[a.model.served];
  const topics = [...a.topics].sort((x, y) => y.within_1y - x.within_1y);
  const usually = (d: number | null) => (d === null ? "more than 4 years" : duration(d));
  const curves = CURVES.filter(([c]) => tn.still_open_curves[c]).map(([c, name], i) => ({
    name,
    color: SERIES[i],
    points: Object.entries(tn.still_open_curves[c].still_open).map(([m, v]) => [Number(m), v] as [number, number]),
  }));

  return (
    <div className="m-wrap m-page">
      <header className="m-title">
        <h1>What 81 million court cases show</h1>
        <p>Every case filed in India&apos;s district courts from 2010 to 2018, and 3.6 million of them from Tamil Nadu looked at closely.</p>
      </header>

      <dl className="m-kpis mt-6">
        <div>
          <dd className="m-kpi-value">{all.median_days ? duration(all.median_days) : "—"}</dd>
          <dt className="m-kpi-label">until half of Tamil Nadu&apos;s cases are over</dt>
        </div>
        <div>
          <dd className="m-kpi-value">{outOf10(all.still_open["48"])} in 10</dd>
          <dt className="m-kpi-label">cases still not over after 4 years</dt>
        </div>
        <div>
          <dd className="m-kpi-value">{Math.round((stage.median_after_first_hearing / (stage.median_after_first_hearing + stage.median_wait_first_hearing)) * 100)}%</dd>
          <dt className="m-kpi-label">of a real dispute&apos;s time comes after its first hearing</dt>
        </div>
      </dl>

      <div className="m-grid mt-3 lg:grid-cols-2">
        <Figure
          title="1. What the case is about changes everything"
          note="Share of cases over within a year, Tamil Nadu, filed 2015–2017."
          table={<Table head={["Case", "Over within a year", "Usually takes"]} rows={topics.map((t) => [t.title, pct(t.within_1y), usually(t.timing.median_days)])} />}
        >
          <BarList rows={topics.map((t) => ({ label: t.title, value: t.within_1y, detail: `usually takes ${usually(t.timing.median_days)}` }))} format={(v) => pct(v)} max={1} />
        </Figure>

        <Figure
          title="2. How long cases stay open"
          note={`The share of cases still not over, from the day they are filed. Across all Tamil Nadu cases, half are over after ${all.median_days ? duration(all.median_days) : "—"}.${tn.still_open_curves.stc ? ` Quick summary trials start lower because ${pct(1 - tn.still_open_curves.stc.still_open["0"])} of them end the day they are filed.` : ""}`}
          table={
            <Table
              head={["Kind", "After 1 year", "After 2 years", "After 4 years"]}
              rows={CURVES.filter(([c]) => tn.still_open_curves[c]).map(([c, name]) => {
                const so = tn.still_open_curves[c].still_open;
                return [name, pct(so["12"]), pct(so["24"]), pct(so["48"])];
              })}
            />
          }
        >
          <LineChart series={curves} width={560} xFormat={(m) => (m === 0 ? "filed" : m % 12 === 0 ? `${m / 12} year${m === 12 ? "" : "s"}` : `${m} months`)} xTicks={[0, 12, 24, 36, 48]} yFormat={(v) => pct(v)} yMax={1} height={320} />
        </Figure>

        <Figure
          title="3. Where the time goes in a real dispute"
          note={`Time after the first hearing, by kind of case. Overall a dispute waits ${Math.round(stage.median_wait_first_hearing)} days for its first hearing, then runs ${duration(stage.median_after_first_hearing)} more, with hearings about ${Math.round(stage.median_gap_between_hearings)} days apart.`}
          table={<Table head={["Kind of case", "Wait for first hearing", "After first hearing", "Gap between hearings"]} rows={h.stages.by_type.map((s) => [shortName(s.name), `${Math.round(s.median_wait_first_hearing)} days`, s.median_after_first_hearing === null ? "more than half never ended" : duration(s.median_after_first_hearing), s.median_gap_between_hearings === null ? "—" : `${Math.round(s.median_gap_between_hearings)} days`])} />}
        >
          <BarList rows={h.stages.by_type.filter((s) => s.median_after_first_hearing !== null).map((s) => ({ label: shortName(s.name), value: s.median_after_first_hearing as number, detail: `first hearing after ${Math.round(s.median_wait_first_hearing)} days` }))} format={(v) => duration(v)} limit={10} itemLabel="kinds of case" wideValue />
        </Figure>

        <Figure
          title="4. Where open disputes are stuck"
          note={`The stage recorded at the latest hearing, for ${h.stuck_at.cases_open.toLocaleString("en-IN")} disputes filed 2015–2017 still open when the data was collected.`}
          table={<Table head={["Stage", "Share of open disputes"]} rows={h.stuck_at.top.map((s) => [s.stage, pct(s.share, 1)])} />}
        >
          <BarList rows={h.stuck_at.top.map((s) => ({ label: s.stage, value: s.share }))} format={(v) => pct(v)} limit={10} itemLabel="stages" />
        </Figure>

        <HowDisputesEnd />

        <Figure
          title="6. Where the case is filed matters too"
          note="Share of cases over within a year, by district (Tamil Nadu, filed 2015–2017)."
          table={<Table head={["District", "Over within a year", "Cases"]} rows={districts.map((d) => [d.district, pct(d.mean), d.size.toLocaleString("en-IN")])} />}
        >
          <label className="mb-3 block">
            <span className="sr-only">Find a district</span>
            <input className="m-search" type="search" placeholder="Find a district, like Madurai" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {districts.length === 0 && <p className="text-sm text-[var(--m-ink-2)]">No districts match your search.</p>}
          <BarList sortable rows={districts.map((d) => ({ label: d.district, value: d.mean, detail: `${d.size.toLocaleString("en-IN")} cases` }))} format={(v) => pct(v)} max={1} limit={10} itemLabel="districts" />
        </Figure>

        <Figure
          title="7. Across India, some states have huge backlogs"
          note="Of the cases filed in 2010, the share still not over when the data was collected in early 2019. Tamil Nadu is in black."
          table={<Table head={["State", "Still not over"]} rows={a.national.states.map((s) => [s.state, pct(s.pending_2010_filings, 1)])} />}
        >
          <BarList sortable rows={a.national.states.map((s) => ({ label: s.state, value: s.pending_2010_filings, highlight: s.state === "Tamil Nadu", detail: `${s.cases.toLocaleString("en-IN")} cases` }))} format={(v) => pct(v)} limit={14} itemLabel="states" />
        </Figure>

        <section className="m-panel lg:col-span-2">
          <h2 className="m-h2">8. Can you tell on the day a case is filed?</h2>
          <p className="mt-2 max-w-[72ch] text-[var(--m-ink-2)]">
            Partly. On {served.n.toLocaleString("en-IN")} real cases from 2017 it never saw, the model was right {pct(served.accuracy, 1)} of the time, but most of that is telling petty cases from everything else. On real disputes it was right{" "}
            <b className="font-semibold text-[var(--m-ink)]">{pct(h.table.contested.accuracy, 1)}</b> of the time, against <b className="font-semibold text-[var(--m-ink)]">{pct(h.table.contested.majority_accuracy, 1)}</b> for always guessing the commonest answer. Filing-day information tells you what kind of case it is, and little more. That fits chart 3: what decides a dispute&apos;s length seems to happen after it starts.
          </p>
          <Link href="/model/pipeline" className="m-link mt-3 inline-block">
            How it was built and tested
          </Link>
        </section>
      </div>
    </div>
  );
}
