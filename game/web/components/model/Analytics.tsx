"use client";
import { useQuery } from "@tanstack/react-query";
import { duration, getAnalytics, pct, type Analytics as Data } from "@/lib/model";
import { BarList, CalibrationChart, Figure, LineChart, SERIES, Table } from "./Charts";

const CURVES = ["all cases", "stc", "os", "cc", "mcop", "hmop"];
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-[var(--m-ink-2)]">{label}</p>
    </div>
  );
}

export function Analytics() {
  const q = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity });
  if (q.isError) return <p className="text-[var(--m-critical)]">Couldn&apos;t load the analytics. Try again in a minute.</p>;
  if (!q.data) return <p className="text-[var(--m-ink-2)]">Loading the analytics…</p>;
  return <Body a={q.data} />;
}

function Body({ a }: { a: Data }) {
  const tn = a.tamil_nadu;
  const served = a.model.test[a.model.served];
  const monthly = Object.entries(a.national.monthly_decisions).map(([k, v]) => {
    const [y, m] = k.split("-").map(Number);
    return [y + (m - 1) / 12, v / 1000] as [number, number];
  });
  const scrape = 2019 + 1 / 12;
  const same = Object.entries(tn.survivorship.cases_in_those_courts).map(([y, v]) => ({ label: y, value: v }));
  const first = same[0]?.value ?? 1;
  const curves = CURVES.filter((c) => tn.still_open_curves[c]).map((c, i) => ({
    name: tn.still_open_curves[c].label.split(" (")[0],
    color: c === "all cases" ? "var(--m-ink-3)" : SERIES[(i - 1) % SERIES.length],
    dashed: c === "all cases",
    points: Object.entries(tn.still_open_curves[c].still_open).map(([m, v]) => [Number(m), v] as [number, number]),
  }));
  const clusters = tn.district_clusters;
  const bestSil = Math.max(...Object.values(clusters.silhouette));
  const allCurve = tn.still_open_curves["all cases"];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">What 81 million court cases show</h1>
        <p className="mt-1 max-w-3xl text-[var(--m-ink-2)]">
          Every Indian district-court case filed 2010–2018 (from eCourts, via Development Data Lab), then Tamil Nadu in detail. All
          numbers are computed by the pipeline; see About for how.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat value={`${(a.national.cases / 1e6).toFixed(1)} M`} label="cases filed in India, 2010–2018" />
        <Stat value={`${(tn.cases / 1e6).toFixed(2)} M`} label="of them in Tamil Nadu" />
        <Stat value={allCurve.median_days ? duration(allCurve.median_days) : "—"} label="until half of TN cases filed 2015–18 end" />
        <Stat value={served.auc.toFixed(3)} label="model AUC on unseen 2017 cases" />
      </section>

      <Figure
        title="When the data was collected: decisions per month, all India (thousands)"
        note="There is no 'scraped on' date in the data, but the scrape leaves a fingerprint: decisions stop being recorded. Most courts were scraped in January–February 2019, so a case without a decision is only known to be pending until then."
        table={<Table head={["month", "decisions"]} rows={Object.entries(a.national.monthly_decisions).map(([k, v]) => [k, v.toLocaleString("en-IN")])} />}
      >
        <LineChart
          series={[{ name: "Decisions per month (thousands)", color: "var(--m-s1)", points: monthly }]}
          xFormat={(x) => `${M[Math.round((x % 1) * 12) % 12]} ${Math.floor(x + 1e-6)}`}
          yFormat={(y) => y.toFixed(0)}
          marker={{ x: scrape, label: "scrape" }}
        />
      </Figure>

      <div className="grid gap-6 lg:grid-cols-2">
        <Figure
          title="2010 filings still open at the scrape, by state"
          note="Part real backlog, part cases never updated in the system. States with over 100,000 cases and a clear scrape date."
          table={<Table head={["state", "still open", "scrape"]} rows={a.national.states.map((s) => [s.state, pct(s.pending_2010_filings, 1), s.cutoff ?? "—"])} />}
        >
          <BarList
            rows={a.national.states.map((s) => ({ label: s.state, value: s.pending_2010_filings, highlight: s.state === "Tamil Nadu", detail: `${s.cases.toLocaleString("en-IN")} cases` }))}
            format={(v) => pct(v)}
          />
        </Figure>
        <Figure
          title={`The early years are incomplete: cases per filing year in the same ${tn.survivorship.courts_present_2010} Tamil Nadu courts`}
          note={`×${((same[same.length - 1]?.value ?? first) / first).toFixed(1)} from 2010 to 2018 in courts that existed throughout. Cases that ended quickly before a court went digital were mostly never entered, so the model only learns from 2015–2017.`}
          table={<Table head={["filing year", "cases"]} rows={same.map((s) => [s.label, s.value.toLocaleString("en-IN")])} />}
        >
          <BarList rows={same} format={(v) => v.toLocaleString("en-IN")} sort={false} />
        </Figure>
      </div>

      <Figure
        title="Still open after N months, Tamil Nadu filings 2015–2018"
        note="Kaplan–Meier: pending cases count as open until the scrape, transferred ones until their transfer, instead of being dropped (dropping them makes courts look far faster)."
        table={
          <Table
            head={["case type", "cases", "median", "open at 12 m", "at 24 m", "at 48 m"]}
            rows={Object.values(tn.still_open_curves).map((c) => [
              c.label,
              c.cases.toLocaleString("en-IN"),
              c.median_days ? duration(c.median_days) : "not reached",
              pct(c.still_open["12"]),
              pct(c.still_open["24"]),
              pct(c.still_open["48"]),
            ])}
          />
        }
      >
        <LineChart series={curves} xFormat={(m) => `${m} months`} yFormat={(v) => pct(v)} yMax={1} height={300} />
      </Figure>

      <div className="grid gap-6 lg:grid-cols-2">
        <Figure
          title="Disposed of within a year, by kind of case (TN, filed 2015–2017)"
          table={<Table head={["case type", "within a year", "cases"]} rows={tn.within_1y_by_type.map((t) => [a.case_type_names[t.type] ?? t.type, pct(t.mean), t.size.toLocaleString("en-IN")])} />}
        >
          <BarList rows={tn.within_1y_by_type.map((t) => ({ label: a.case_type_names[t.type] ?? t.type, value: t.mean, detail: `${t.size.toLocaleString("en-IN")} cases` }))} format={(v) => pct(v)} max={1} />
        </Figure>
        <Figure
          title="…and by court (≥ 2,000 cases)"
          table={<Table head={["court", "within a year", "cases"]} rows={tn.within_1y_by_court_level.map((c) => [c.court_level, pct(c.mean), c.size.toLocaleString("en-IN")])} />}
        >
          <BarList
            rows={tn.within_1y_by_court_level.filter((c) => c.size >= 2000).map((c) => ({ label: c.court_level, value: c.mean, detail: `${c.size.toLocaleString("en-IN")} cases` }))}
            format={(v) => pct(v)}
            max={1}
          />
        </Figure>
      </div>

      <Figure
        title="Disposed of within a year, by district (TN, filed 2015–2017)"
        note={`k-means on district profiles (rates for six big case types + backlog) finds ${clusters.k} groups, but the best silhouette is only ${bestSil.toFixed(2)}: districts differ by degree rather than falling into clear types. The group is shown in each tooltip as a summary only.`}
        table={<Table head={["district", "within a year", "cases", "k-means group"]} rows={tn.within_1y_by_district.map((d) => [d.district, pct(d.mean), d.size.toLocaleString("en-IN"), clusters.district_cluster[d.district] ?? "—"])} />}
      >
        <BarList
          rows={tn.within_1y_by_district.map((d) => ({ label: d.district, value: d.mean, detail: `group ${clusters.district_cluster[d.district] ?? "—"} · ${d.size.toLocaleString("en-IN")} cases` }))}
          format={(v) => pct(v)}
          max={1}
        />
      </Figure>

      <section className="space-y-3">
        <h2 className="text-xl font-bold tracking-tight">How good is the model?</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Figure
            title="Unseen 2017 cases: models vs simple baselines"
            note="AUC: how well cases are ranked; the bars start at 0.5, a coin flip. Brier (in each tooltip): how far the probabilities are from what happened, lower is better."
            table={
              <Table
                head={["approach", "AUC", "Brier", "accuracy"]}
                rows={Object.entries(a.model.test).map(([k, m]) => [k, m.auc.toFixed(3), m.brier.toFixed(3), pct(m.accuracy, 1)])}
              />
            }
          >
            <BarList
              rows={Object.entries(a.model.test)
                .filter(([k]) => !k.startsWith("baseline: overall"))
                .map(([k, m]) => ({ label: k.replace("baseline: ", "").replace(" (calibrated)", "").split(" (")[0], value: m.auc, highlight: k === a.model.served, detail: `Brier ${m.brier.toFixed(3)}` }))}
              format={(v) => v.toFixed(3)}
              min={0.5}
              max={0.9}
            />
          </Figure>
          <Figure title="Is a predicted 70% really 70%?" note="Each dot is a band of 2017 cases; on the dashed line, the stated chance comes true exactly that often.">
            <CalibrationChart points={a.model.calibration.map((c) => ({ predicted: c.mean_predicted, observed: c.observed, cases: c.cases }))} />
          </Figure>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Figure title="Other time horizons (served model vs rate per case type)" table={null}>
            <Table
              head={["question", "model AUC", "per-type AUC", "test year"]}
              rows={Object.entries(a.experiments.horizons).map(([k, h]) => [`within ${k}`, h.model.auc.toFixed(3), h["baseline: rate per case type"].auc.toFixed(3), h.test])}
            />
          </Figure>
          <Figure
            title="Where it is weakest: ranking cases of the same kind"
            note="Within one case type, AUC near 0.5 means the model can't tell which of two such cases will finish first. It mostly knows which kinds of case are quick."
          >
            <Table
              head={["case type", "AUC within type", "cases"]}
              rows={a.experiments.weak_case_types.map((w) => [a.case_type_names[w.case_type] ?? w.case_type.toUpperCase(), w.auc?.toFixed(3) ?? "—", w.n.toLocaleString("en-IN")])}
            />
          </Figure>
        </div>
      </section>
    </div>
  );
}
