"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { duration, getAnalytics, outOf10, pct, type Analytics as Data } from "@/lib/model";
import { BarList, Figure, LineChart, SERIES, Table } from "./Charts";

/** "What the data shows": a few plain stories, one chart each. The technical charts live on
 *  "How it works". */

const CURVES: [string, string][] = [
  ["stc", "Quick summary trials"],
  ["hmop", "Marriage petitions"],
  ["os", "Civil suits"],
  ["mcop", "Accident claims"],
  ["cc", "Full criminal trials"],
];

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-[var(--m-ink-2)]">{label}</p>
    </div>
  );
}

export function Analytics() {
  const q = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity });
  if (q.isError) return <p className="text-[var(--m-critical)]">Couldn&apos;t load this page. Please reload in a minute.</p>;
  if (!q.data) return <p className="text-[var(--m-ink-2)]">Loading…</p>;
  return <Stories a={q.data} />;
}

function Stories({ a }: { a: Data }) {
  const tn = a.tamil_nadu;
  const all = tn.still_open_curves["all cases"];
  const served = a.model.test[a.model.served];
  const topics = [...a.topics].sort((x, y) => y.within_1y - x.within_1y);
  const curves = CURVES.filter(([c]) => tn.still_open_curves[c]).map(([c, name], i) => ({
    name,
    color: SERIES[i],
    points: Object.entries(tn.still_open_curves[c].still_open).map(([m, v]) => [Number(m), v] as [number, number]),
  }));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What 81 million court cases show</h1>
        <p className="mt-2 max-w-2xl text-lg text-[var(--m-ink-2)]">
          Every case filed in India&apos;s district courts from 2010 to 2018, and 3.6 million of them from Tamil Nadu looked at closely.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Big value={all.median_days ? duration(all.median_days) : "—"} label="until half of Tamil Nadu's cases are over" />
        <Big value={`${outOf10(all.still_open["48"])} in 10`} label="cases still not over after 4 years" />
        <Big value={`${outOf10(served.accuracy)} in 10`} label="times the model guesses right on cases it never saw" />
      </section>

      <Figure
        title="1. What the case is about changes everything"
        note="Share of cases that were over within a year, Tamil Nadu, filed 2015–2017. Bail applications and traffic fines end in days; cheque bounces, accident claims and appeals drag on for years."
        table={<Table head={["case", "over within a year", "usually takes"]} rows={topics.map((t) => [`${t.icon} ${t.title}`, pct(t.within_1y), t.timing.median_days === null ? "more than 4 years" : duration(t.timing.median_days)])} />}
      >
        <BarList
          rows={topics.map((t) => ({
            label: `${t.icon} ${t.title}`,
            value: t.within_1y,
            detail: `usually takes ${t.timing.median_days === null ? "more than 4 years" : duration(t.timing.median_days)}`,
          }))}
          format={(v) => pct(v)}
          max={1}
        />
      </Figure>

      <Figure
        title="2. How long cases stay open"
        note={`The share of cases still not over, from the day they are filed. Across all Tamil Nadu cases, half are over after ${all.median_days ? duration(all.median_days) : "—"}.`}
        table={
          <Table
            head={["kind", "still open after 1 year", "after 2 years", "after 4 years"]}
            rows={CURVES.filter(([c]) => tn.still_open_curves[c]).map(([c, name]) => {
              const so = tn.still_open_curves[c].still_open;
              return [name, pct(so["12"]), pct(so["24"]), pct(so["48"])];
            })}
          />
        }
      >
        <LineChart
          series={curves}
          xFormat={(m) => (m === 0 ? "filed" : m % 12 === 0 ? `${m / 12} year${m === 12 ? "" : "s"}` : `${m} months`)}
          xTicks={[0, 12, 24, 36, 48]}
          yFormat={(v) => pct(v)}
          yMax={1}
          height={300}
        />
      </Figure>

      <Figure
        title="3. Where the case is filed matters too"
        note="Share of cases over within a year, by district (Tamil Nadu, filed 2015–2017). The same kinds of case move at very different speeds in different districts."
        table={<Table head={["district", "over within a year", "cases"]} rows={tn.within_1y_by_district.map((d) => [d.district, pct(d.mean), d.size.toLocaleString("en-IN")])} />}
      >
        <BarList rows={tn.within_1y_by_district.map((d) => ({ label: d.district, value: d.mean, detail: `${d.size.toLocaleString("en-IN")} cases` }))} format={(v) => pct(v)} max={1} />
      </Figure>

      <Figure
        title="4. Across India, some states have huge backlogs"
        note="Of the cases filed in 2010, the share still not over when the data was collected in early 2019, nine years later. Tamil Nadu is highlighted."
        table={<Table head={["state", "still not over"]} rows={a.national.states.map((s) => [s.state, pct(s.pending_2010_filings, 1)])} />}
      >
        <BarList rows={a.national.states.map((s) => ({ label: s.state, value: s.pending_2010_filings, highlight: s.state === "Tamil Nadu", detail: `${s.cases.toLocaleString("en-IN")} cases` }))} format={(v) => pct(v)} />
      </Figure>

      <section className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
        <h2 className="text-lg font-semibold">5. How good is the model?</h2>
        <p className="mt-1 text-[var(--m-ink-2)]">
          Tested on {served.n.toLocaleString("en-IN")} real cases from 2017 that it never saw while learning, it guessed whether each would be over within a
          year correctly about <b className="text-[var(--m-ink)]">{outOf10(served.accuracy)} times in 10</b>. Its weak spot: it knows which <i>kinds</i> of case are
          quick, but between two cases of the same kind it can&apos;t tell well which will finish first.
        </p>
        <Link href="/model/about" className="mt-3 inline-block font-medium text-[var(--m-s1)] underline">
          How it was built and tested →
        </Link>
      </section>
    </div>
  );
}
