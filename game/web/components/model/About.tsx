"use client";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics, outOf10, pct, type Analytics } from "@/lib/model";
import { BarList, CalibrationChart, Figure, LineChart, Table } from "./Charts";
import { REPO } from "./Shell";

/** "How it works": plain first, then the technical detail (folded) for the professor and the viva. */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-[var(--m-ink-2)] [&_b]:text-[var(--m-ink)]">{children}</div>
    </section>
  );
}

export function About() {
  const q = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity });
  const a = q.data;
  const served = a ? a.model.test[a.model.served] : null;
  return (
    <div className="space-y-5">
      <section className="story-hero">
        <p className="model-eyebrow">03 / BEHIND THE MODEL</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h1>
        <p className="mt-2 max-w-2xl text-lg text-[var(--m-ink-2)]">An IDSE (CS3006) course project: real, messy government data taken all the way to a working model.</p>
      </section>

      <div className="method-steps" aria-label="Pipeline stages"><span><b>01</b> Gather</span><span><b>02</b> Clean</span><span><b>03</b> Learn</span><span><b>04</b> Test</span></div>

      <Card title="In short">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            We downloaded the records of <b>81 million</b> Indian court cases (2010–2018), published by Development Data Lab from the government&apos;s
            eCourts website, with personal details removed.
          </li>
          <li>We cleaned them: the same law was typed in thousands of different ways, dates were impossible, court names were full of typos.</li>
          <li>
            For <b>3.6 million Tamil Nadu cases</b> we worked out how long each one took, carefully counting cases that were still going when the data was
            collected.
          </li>
          <li>
            A model learned from cases filed in 2015–2016 and was then tested on {served ? served.n.toLocaleString("en-IN") : "549,273"} cases from 2017 it had
            never seen. It guessed right about <b>{served ? outOf10(served.accuracy) : 8} times in 10</b>.
          </li>
        </ol>
      </Card>

      <Card title="What it looks at">
        <p>
          Only things known on the day a case is filed: what it is about (the law and section), the kind of court, the district, and how busy those
          courts were. It never looks at names, gender or anything about the people involved.
        </p>
      </Card>

      <Card title="What it can't do">
        <ul className="list-disc space-y-1 pl-5">
          <li>It describes past cases (filed 2015–2017, data collected in early 2019). Courts have changed since, and were getting faster each year.</li>
          <li>It knows which kinds of case are quick. Between two cases of the same kind, it can barely tell which will finish first.</li>
          <li>It is not a prediction for any real case, and it is not legal advice.</li>
        </ul>
      </Card>

      {a && <Technical a={a} />}

      <p className="text-sm text-[var(--m-ink-3)]">
        Data: Development Data Lab&apos;s judicial data, licence ODbL v1.0. Full method, code, tests and notebooks:{" "}
        <a className="underline" href={REPO} target="_blank" rel="noreferrer">
          pipeline/ on GitHub
        </a>
        .
      </p>
    </div>
  );
}

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Technical({ a }: { a: Analytics }) {
  const tn = a.tamil_nadu;
  const c = tn.cleaning;
  const monthly = Object.entries(a.national.monthly_decisions).map(([k, v]) => {
    const [y, m] = k.split("-").map(Number);
    return [y + (m - 1) / 12, v / 1000] as [number, number];
  });
  const same = Object.entries(tn.survivorship.cases_in_those_courts).map(([y, v]) => ({ label: y, value: v }));
  const served = a.model.test[a.model.served];
  const lookup = a.model.test["baseline: rate per case type x district"];
  const silhouette = Math.max(...Object.values(tn.district_clusters.silhouette));
  return (
    <details className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5" data-testid="technical">
      <summary className="cursor-pointer text-lg font-semibold">For the technical reader: method, tests and charts</summary>
      <div className="mt-4 space-y-5">
        <Card title="Cleaning, measured">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {c.raw_law_names.toLocaleString("en-IN")} raw law names → {c.canonical_laws} laws by tested rules ({pct(c.law_rows_named, 1)} of rows named; the rest
              left as &ldquo;Other&rdquo;, not guessed).
            </li>
            <li>
              {c.raw_court_names} court names → {c.court_levels} groups (including &ldquo;unclear&rdquo;); section strings like &ldquo;138r/w142&rdquo; and &ldquo;OVIIR1&rdquo; → 138, Order 7.
            </li>
            <li>Impossible dates (year 0001, 5000-01-01) blanked and counted; {c.decided_before_filing.toLocaleString("en-IN")} cases &ldquo;decided before filing&rdquo; set aside.</li>
            <li>Licence in the download is ODbL v1.0 (the website says CC BY-NC-SA).</li>
          </ul>
        </Card>

        <Figure
          title="No scrape date in the data: estimated from where decisions stop (all India, thousands per month)"
          note="Decisions collapse in January–February 2019: the data was collected then. A case with no decision is only known to be pending up to that date, estimated district by district."
        >
          <LineChart
            series={[{ name: "Decisions per month (thousands)", color: "var(--m-s1)", points: monthly }]}
            xFormat={(x) => `${M[Math.round((x % 1) * 12) % 12]} ${Math.floor(x + 1e-6)}`}
            yFormat={(y) => y.toFixed(0)}
            marker={{ x: 2019 + 1 / 12, label: "scrape" }}
          />
        </Figure>

        <Figure
          title={`Early years are incomplete: cases per filing year in the same ${tn.survivorship.courts_present_2010} Tamil Nadu courts`}
          note="Cases that ended quickly before a court went digital were mostly never entered, so early years look slower than they were. The model only learns from 2015–2017."
        >
          <BarList rows={same} format={(v) => v.toLocaleString("en-IN")} sort={false} />
        </Figure>

        <Card title="Labels and the time split">
          <p>
            A case is labelled &ldquo;over within a year?&rdquo; only if its court was watched for at least a year after filing; transfers before a year stay unlabelled.
            Models: logistic regression, linear SVM and random forest, against simple baselines. Chosen on 2016 filings, refitted on 2015–2016, tested once on 2017.
          </p>
          <p>
            Served model (logistic regression with the law inputs): <b>AUC {served.auc.toFixed(3)}</b>, <b>Brier {served.brier.toFixed(3)}</b>, versus{" "}
            {lookup.auc.toFixed(3)} / {lookup.brier.toFixed(3)} for a lookup table of the rate per case type and district. Still-open curves use Kaplan–Meier;
            k-means on districts finds only weak groups (best silhouette {silhouette.toFixed(2)}).
          </p>
        </Card>

        <Figure title="2017 test: models vs baselines (AUC; bars start at 0.5, a coin flip)">
            <BarList
              rows={Object.entries(a.model.test)
                .filter(([k]) => !k.startsWith("baseline: overall"))
                .map(([k, m]) => ({ label: k.replace("baseline: ", "").replace(" (calibrated)", "").split(" (")[0], value: m.auc, highlight: k === a.model.served, detail: `Brier ${m.brier.toFixed(3)}` }))}
              format={(v) => v.toFixed(3)}
              min={0.5}
              max={0.9}
            />
        </Figure>
        <Figure title="Calibration: is a predicted 70% really 70%?">
          <CalibrationChart points={a.model.calibration.map((x) => ({ predicted: x.mean_predicted, observed: x.observed, cases: x.cases }))} />
        </Figure>

        <div className="grid gap-5 lg:grid-cols-2">
          <Figure title="Other horizons (served model vs rate per case type)">
            <Table
              head={["question", "model AUC", "per-type AUC", "test year"]}
              rows={Object.entries(a.experiments.horizons).map(([k, h]) => [`within ${k}`, h.model.auc.toFixed(3), h["baseline: rate per case type"].auc.toFixed(3), h.test])}
            />
          </Figure>
          <Figure title="Weak spot: ranking cases of the same kind (AUC within one case type)">
            <Table
              head={["case type", "AUC", "cases"]}
              rows={a.experiments.weak_case_types.map((w) => [a.case_type_names[w.case_type] ?? w.case_type.toUpperCase(), w.auc?.toFixed(3) ?? "—", w.n.toLocaleString("en-IN")])}
            />
          </Figure>
        </div>
      </div>
    </details>
  );
}
