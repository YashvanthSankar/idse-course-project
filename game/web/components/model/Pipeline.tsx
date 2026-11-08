import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import notebookJson from "@/public/pipeline/notebook.json";
import resultsJson from "@/public/pipeline/results.json";
import { CalibrationChart, Table } from "./Charts";
import { PipelineCode } from "./PipelineCode";

/** The pipeline page: the master notebook (pipeline/notebooks/00_full_pipeline.ipynb) as a
 *  designed walkthrough. Everything here comes from game/web/public/pipeline/, written by
 *  pipeline/scripts/export_notebook.py from the executed notebook, so the page needs nothing
 *  outside game/web at runtime. */

type Block =
  | { type: "text"; text: string }
  | { type: "table"; html: string }
  | { type: "image"; src: string; width: number; height: number };
type Cell = { code: string; blocks: Block[] };
type Stage = { id: string; title: string; intro_html: string; cells: Cell[]; takeaway: string };
type Part = { id: string; title: string; stages: Stage[] };
type Notebook = {
  generated: string;
  title: string;
  intro_html: string;
  setup_code: string;
  parts: Part[];
  summary_html: string;
  checks: { agree: number; total: number; text: string } | null;
};
type Metric = { name: string; served: boolean; family: string; inputs: string; accuracy: number; auc: number; brier: number; log_loss: number; n: number };
type Results = {
  served: string;
  test_year: number;
  train_years: number[];
  models: Metric[];
  confusion: { tp: number; fp: number; fn: number; tn: number; precision: number; recall: number; accuracy: number };
  model_info: { train_cases: number; test_cases: number; file_bytes: number; n_inputs: number; library: string };
  calibration: { predicted: string; cases: number; mean_predicted: number; observed: number }[];
  horizons: Record<string, { model_auc: number; baseline_auc: number; train: number[]; test: number }>;
  drift: Record<string, { auc: number; mean_predicted: number; observed: number }>;
  weak_case_types: { case_type: string; n: number; auc: number | null; observed: number }[];
  case_type_names: Record<string, string>;
  days_regression: {
    linear_regression: { n: number; mae_days: number; median_error_days: number; r2_log_days: number };
    baseline_median_per_case_type: { mae_days: number; median_error_days: number; r2_log_days: number };
  };
  clusters: { k: number; best_silhouette: number };
  cleaning: { raw_law_names: number; canonical_laws: number; raw_court_names: number; court_levels: number; decided_before_filing: number };
  cases: { national: number; tamil_nadu: number };
  within_1y_by_year: Record<string, number>;
  still_open_all: { median_days: number | null; still_open: Record<string, number> };
};

const NB = notebookJson as Notebook;
const RES = resultsJson as Results;
const NOTEBOOK_FILE = "/pipeline/00_full_pipeline.ipynb";

const n = (x: number) => x.toLocaleString("en-IN");
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const f3 = (x: number) => x.toFixed(3);

const PART_BLURB: Record<string, string> = {
  A: "From the raw download to a cleaned, honestly labelled table. Every problem is measured before it is fixed, and two facts about the data (when it was collected, and what the early years are missing) decide how the model can be built at all.",
  B: "From the cleaned table to a tested model. Only filing-day inputs, a split by time, simple baselines first, three model families, one test on a later year the models never saw, and the weak spots stated plainly.",
};

/* Markdown from the notebook (rendered to HTML by the exporter) in the site's type. */
const PROSE =
  "space-y-3 text-[15px] leading-7 text-[var(--m-ink-2)] [&_strong]:font-semibold [&_strong]:text-[var(--m-ink)] [&_em]:text-[var(--m-ink)] " +
  "[&_code]:rounded [&_code]:bg-[var(--m-blue-100)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[var(--m-ink)] " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_li]:pl-1 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--m-s2)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--m-ink)] [&_a]:underline " +
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[13.5px] [&_table]:leading-5 [&_th]:border-b [&_th]:border-[var(--m-line)] [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--m-ink)] " +
  "[&_td]:border-b [&_td]:border-[var(--m-line)] [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top";

/* pandas tables printed by the notebook. */
const DATAFRAME =
  "overflow-x-auto rounded-lg border border-[var(--m-line)] [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12.5px] [&_table]:leading-5 [&_table]:tabular-nums " +
  "[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-[var(--m-line)] [&_th]:bg-[var(--m-blue-100)] [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-[var(--m-ink)] " +
  "[&_td]:min-w-[5rem] [&_td]:border-b [&_td]:border-[var(--m-line)] [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-[var(--m-ink-2)] [&_tbody_th]:bg-transparent [&_tbody_th]:font-normal [&_tbody_th]:text-[var(--m-ink)] [&_tr:last-child_td]:border-b-0 [&_tr:last-child_th]:border-b-0";

function Html({ html, className }: { html: string; className: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <strong className="block font-[Georgia,serif] text-[26px] font-normal leading-tight text-[var(--m-ink)] sm:text-[30px]">{value}</strong>
      <span className="mt-1 block text-[12px] leading-snug text-[var(--m-ink-3)]">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

export function Pipeline() {
  const served = RES.models.find((m) => m.served)!;
  const lookup = RES.models.find((m) => m.name.includes("district"))!;
  const stages = NB.parts.flatMap((p) => p.stages);
  return (
    <div className="space-y-12 sm:space-y-16">
      <Hero served={served} stageCount={stages.length} />
      <FlowMap parts={NB.parts} />
      {NB.parts.map((part) => (
        <section key={part.id} id={`part-${part.id}`} className="scroll-mt-24 space-y-8">
          <PartHeader part={part} />
          {part.stages.map((stage, i) => (
            <StageCard key={stage.id} stage={stage} index={i + 1} total={part.stages.length} />
          ))}
          {part.id === "A" && <Handoff />}
        </section>
      ))}
      <ResultsSection served={served} lookup={lookup} />
      <Closing />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function Hero({ served, stageCount }: { served: Metric; stageCount: number }) {
  const so = RES.still_open_all;
  return (
    <section className="story-hero">
      <p className="model-eyebrow">THE PIPELINE</p>
      <h1 className="max-w-4xl">From 81 million raw court records to one tested model</h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-7 text-[var(--m-ink-2)]">
        This page walks through the whole project in {stageCount} steps, in the order the work was done: first the <b className="font-semibold text-[var(--m-ink)]">data analysis pipeline</b> (get the
        data, measure the mess, clean it, label it honestly, look at it), then the <b className="font-semibold text-[var(--m-ink)]">machine-learning pipeline</b> (choose the inputs, split by
        time, beat the baselines, test once, state the limits). Each step says what was done, why, and what came out, and shows the exact code that produced it.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <a href={NOTEBOOK_FILE} download className="model-primary">
          Download the notebook <span aria-hidden>↓</span>
        </a>
        <a href="#results" className="model-secondary">
          Jump to the results <span aria-hidden>→</span>
        </a>
        <Link href="/model/explore" className="model-secondary">
          Try the model <span aria-hidden>→</span>
        </Link>
      </div>
      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-[var(--m-line)] pt-7 sm:grid-cols-3 lg:grid-cols-6">
        <Stat value={`${(RES.cases.national / 1e6).toFixed(1)} M`} label="court cases in the download (all India, 2010–2018)" />
        <Stat value={`${(RES.cases.tamil_nadu / 1e6).toFixed(2)} M`} label="Tamil Nadu cases cleaned and labelled" />
        <Stat value={n(RES.model_info.train_cases)} label={`cases the model learned from (filed ${RES.train_years.join("–")})`} />
        <Stat value={n(served.n)} label={`cases it was tested on, filed in ${RES.test_year}, never seen before`} />
        <Stat value={`${Math.round(served.accuracy * 10)} in 10`} label={`right about whether a case is over within a year (accuracy ${pct(served.accuracy, 1)})`} />
        <Stat value={so.median_days ? `${Math.round(so.median_days / 30.44)} months` : "—"} label="until half of all Tamil Nadu cases are over" />
      </dl>
    </section>
  );
}

function FlowMap({ parts }: { parts: Part[] }) {
  return (
    <nav aria-label="Pipeline steps" className="space-y-4">
      {parts.map((part) => (
        <div key={part.id} className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="model-eyebrow">PART {part.id}</p>
            <a href={`#part-${part.id}`} className="font-[Georgia,serif] text-lg text-[var(--m-ink)] hover:underline">
              {part.title}
            </a>
          </div>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {part.stages.map((s) => (
              <li key={s.id} className="min-w-0">
                <a
                  href={`#${s.id}`}
                  className="flex h-full min-w-0 flex-col gap-1 rounded-lg border border-[var(--m-line)] bg-[var(--m-surface)] px-3 py-2.5 text-[13px] leading-snug text-[var(--m-ink-2)] transition-colors hover:border-[var(--m-blue-200)] hover:text-[var(--m-ink)]"
                >
                  <span className="text-[11px] font-bold tracking-[.12em] text-[var(--m-s2)]">{s.id}</span>
                  <span className="line-clamp-2">{shortTitle(s.title)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </nav>
  );
}

const shortTitle = (t: string) => t.split(/[:(]/)[0].replace(/\?$/, "").trim();

function PartHeader({ part }: { part: Part }) {
  return (
    <header className="border-t border-[var(--m-line)] pt-12">
      <p className="model-eyebrow">PART {part.id} · {part.stages.length} STEPS</p>
      <h2 className="mt-3 font-[Georgia,serif] text-[clamp(1.9rem,3.4vw,2.8rem)] leading-[1.1] tracking-[-.03em] text-[var(--m-ink)]">{part.title}</h2>
      <p className="mt-4 max-w-3xl text-[16px] leading-7 text-[var(--m-ink-2)]">{PART_BLURB[part.id]}</p>
    </header>
  );
}

function Handoff() {
  const years = Object.entries(RES.within_1y_by_year);
  return (
    <div className="rounded-2xl border border-dashed border-[var(--m-blue-200)] bg-[var(--m-blue-100)]/40 p-5 sm:p-6">
      <p className="model-eyebrow">WHAT PART A HANDS TO PART B</p>
      <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[var(--m-ink-2)]">
        One table of Tamil Nadu cases filed 2015–2017 with an honest &ldquo;disposed of within a year&rdquo; label:{" "}
        {years.map(([y, v], i) => (
          <span key={y}>
            {i > 0 && (i === years.length - 1 ? " and " : ", ")}
            <b className="font-semibold text-[var(--m-ink)]">{pct(v)}</b> of {y} filings
          </span>
        ))}
        . Cases with impossible dates were set aside, cases that moved to another court are counted as not finished, and every case was watched for at least a year.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function StageCard({ stage, index, total }: { stage: Stage; index: number; total: number }) {
  const blocks = stage.cells.flatMap((c) => c.blocks);
  const images = blocks.filter((b) => b.type === "image");
  const rest = blocks.filter((b) => b.type !== "image");
  return (
    <article id={stage.id} className="scroll-mt-24 rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)]">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--m-line)] px-5 py-4 sm:px-7">
        <span className="font-[Georgia,serif] text-[28px] leading-none text-[var(--m-s2)]">{stage.id}</span>
        <h3 className="min-w-0 flex-1 text-[19px] font-semibold leading-snug text-[var(--m-ink)] sm:text-[21px]">{stage.title}</h3>
        <span className="text-[11px] tracking-[.12em] text-[var(--m-ink-3)]">
          STEP {index} OF {total}
        </span>
      </header>

      <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div className="min-w-0 space-y-5">
          <Html html={stage.intro_html} className={PROSE} />
          <div className="rounded-xl border-l-4 border-[var(--m-s2)] bg-[var(--m-surface)] px-4 py-3.5">
            <p className="text-[11px] font-bold tracking-[.14em] text-[var(--m-s2)]">WHAT CAME OUT</p>
            <p className="mt-1.5 text-[15px] leading-7 text-[var(--m-ink)]">{stage.takeaway}</p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {images.map((b) => (
            <figure key={b.src} className="overflow-hidden rounded-xl border border-[var(--m-line)] bg-[#fcfcfb] p-2">
              <Image src={b.src} width={b.width} height={b.height} alt={`Chart from step ${stage.id}: ${stage.title}`} unoptimized className="h-auto w-full" />
            </figure>
          ))}
          {rest.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold tracking-[.14em] text-[var(--m-ink-3)]">PRINTED BY THE NOTEBOOK</p>
              {rest.map((b, i) =>
                b.type === "table" ? (
                  <Html key={i} html={b.html} className={DATAFRAME} />
                ) : b.type === "text" ? (
                  <pre key={i} className="whitespace-pre-wrap rounded-lg bg-[var(--m-surface)] px-3.5 py-3 font-mono text-[12.5px] leading-[1.65] text-[var(--m-ink-2)] [overflow-wrap:anywhere]">
                    {b.text}
                  </pre>
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--m-line)] px-5 py-4 sm:px-7">
        {stage.cells.map((c, i) => (
          <PipelineCode key={i} code={c.code} label={stage.cells.length > 1 ? `Show the code (cell ${i + 1})` : "Show the code that produced this"} />
        ))}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------------------------------ */

function ResultsSection({ served, lookup }: { served: Metric; lookup: Metric }) {
  const c = RES.confusion;
  const total = c.tp + c.fp + c.fn + c.tn;
  const reg = RES.days_regression;
  const drift = RES.drift["train 2015-16 (served)"];
  return (
    <section id="results" className="scroll-mt-24 space-y-6 border-t border-[var(--m-line)] pt-12">
      <header>
        <p className="model-eyebrow">RESULTS</p>
        <h2 className="mt-3 font-[Georgia,serif] text-[clamp(1.9rem,3.4vw,2.8rem)] leading-[1.1] tracking-[-.03em] text-[var(--m-ink)]">What the model does on {n(served.n)} cases it never saw</h2>
        <p className="mt-4 max-w-3xl text-[16px] leading-7 text-[var(--m-ink-2)]">
          Every model was fitted on cases filed in {RES.train_years.join(" and ")} and scored once on cases filed in {RES.test_year}. The served model is{" "}
          <b className="font-semibold text-[var(--m-ink)]">{served.name.replace(/, with law and section$/, " with the law and section inputs")}</b>, chosen before the {RES.test_year} cases
          were looked at. <i>Accuracy</i>: how often its yes/no call was right. <i>AUC</i>: how well it ranks a finished case above an unfinished one (0.5 = coin toss). <i>Brier</i> and{" "}
          <i>log loss</i>: how far its probabilities were from what happened (lower is better).
        </p>
      </header>

      <Card title="Model comparison" note={`Test year ${RES.test_year}. Bold row: the served model. The three baselines are what you get without any machine learning.`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13.5px] tabular-nums">
            <thead>
              <tr className="text-[var(--m-ink)]">
                {["Model", "Inputs", "Accuracy", "AUC", "Brier", "Log loss"].map((h) => (
                  <th key={h} className="whitespace-nowrap border-b border-[var(--m-line)] py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RES.models.map((m) => (
                <tr key={m.name} className={m.served ? "bg-[var(--m-blue-100)] font-semibold text-[var(--m-ink)]" : "text-[var(--m-ink-2)]"}>
                  <td className="min-w-[9rem] border-b border-[var(--m-line)] py-2 pr-4">
                    {m.name.split(",")[0]}
                    {m.served && <span className="ml-2 rounded-full bg-[var(--m-s2)] px-2 py-px text-[10px] font-bold tracking-[.1em] text-[#111]">SERVED</span>}
                  </td>
                  <td className="min-w-[7rem] border-b border-[var(--m-line)] py-2 pr-4">{m.inputs === "" ? "lookup table" : m.inputs === "filing basics" ? "filing basics" : "basics + law and section"}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{pct(m.accuracy, 1)}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{f3(m.auc)}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{f3(m.brier)}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{f3(m.log_loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13.5px] leading-6 text-[var(--m-ink-2)]">
          Without the law and section inputs, no model does much better than the case-type × district lookup table (AUC {f3(lookup.auc)}). With them, all three families land within
          0.001 of each other: knowing what the case is about is what helps, and the algorithm barely matters.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Confusion matrix" note={`${RES.test_year} test cases, calling "within a year" when the probability is at least 50%.`}>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-[13px]">
            <div />
            <div className="pb-1 text-center text-[11px] leading-tight text-[var(--m-ink-3)]">
              predicted:
              <br />
              not within a year
            </div>
            <div className="pb-1 text-center text-[11px] leading-tight text-[var(--m-ink-3)]">
              predicted:
              <br />
              within a year
            </div>
            <div className="flex items-center pr-2 text-right text-[11px] leading-tight text-[var(--m-ink-3)]">
              actually
              <br />
              not within
            </div>
            <Cell label="true negative" value={c.tn} total={total} strong />
            <Cell label="false positive" value={c.fp} total={total} />
            <div className="flex items-center pr-2 text-right text-[11px] leading-tight text-[var(--m-ink-3)]">
              actually
              <br />
              within
            </div>
            <Cell label="false negative" value={c.fn} total={total} />
            <Cell label="true positive" value={c.tp} total={total} strong />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
            {[
              ["accuracy", pct(c.accuracy, 1), "right overall"],
              ["precision", pct(c.precision, 1), "when it says yes, how often right"],
              ["recall", pct(c.recall, 1), "of the cases that did finish, how many it called"],
            ].map(([k, v, note]) => (
              <div key={k}>
                <dt className="text-[11px] tracking-[.1em] text-[var(--m-ink-3)]">{k.toUpperCase()}</dt>
                <dd className="font-[Georgia,serif] text-[22px] text-[var(--m-ink)]">{v}</dd>
                <dd className="text-[12px] leading-snug text-[var(--m-ink-3)]">{note}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Is a predicted 70% really 70%?" note="Cases grouped by predicted probability; each dot compares the group's average prediction with the share that really finished within a year. On the dashed line = honest probabilities.">
          <CalibrationChart points={RES.calibration.map((x) => ({ predicted: x.mean_predicted, observed: x.observed, cases: x.cases }))} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Other horizons" note="The same recipe asked for 6 months and 2 years. Each horizon uses the latest years that allow a full follow-up.">
          <Table
            head={["question", "model AUC", "per-type baseline", "train → test"]}
            rows={Object.entries(RES.horizons).map(([k, h]) => [`within ${k}`, f3(h.model_auc), f3(h.baseline_auc), `${h.train.join("–")} → ${h.test}`])}
          />
          <p className="mt-3 text-[13.5px] leading-6 text-[var(--m-ink-2)]">
            Drift: courts got faster each year, so the served model predicts {pct(drift.mean_predicted, 1)} of {RES.test_year} cases within a year when {pct(drift.observed, 1)} were.
          </p>
        </Card>
        <Card title="Weak spot: ranking cases of the same kind" note="AUC inside a single kind of case, 2017, weakest first. Near 0.5 means that, between two cases of that kind, the model cannot tell which will finish first.">
          <Table
            head={["kind of case", "AUC within the kind", "cases"]}
            rows={RES.weak_case_types.map((w) => [RES.case_type_names[w.case_type]?.split(" (")[0] ?? w.case_type.toUpperCase(), w.auc === null ? "—" : w.auc.toFixed(2), n(w.n)])}
          />
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card title="Side analysis: days, by linear regression" note="Among cases disposed of within two years only; trained on 2015 filings, tested on 2016. Exploratory: it cannot speak for the cases that did not finish.">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <Tile value={`${Math.round(reg.linear_regression.median_error_days)} days`} label="typical (median) error" />
            <Tile value={pct(reg.linear_regression.r2_log_days)} label={`of the variation in log(days) explained (baseline ${pct(reg.baseline_median_per_case_type.r2_log_days)})`} />
            <Tile value={`${Math.round(reg.linear_regression.mae_days)} days`} label={`mean error (baseline ${Math.round(reg.baseline_median_per_case_type.mae_days)}: a few long cases dominate the mean)`} />
            <Tile value={n(reg.linear_regression.n)} label="test cases" />
          </dl>
        </Card>
        <Card title="Side analysis: districts, by k-means" note="33 district profiles (speed on six kinds of case plus backlog), standardised; k chosen by silhouette score.">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <Tile value={`k = ${RES.clusters.k}`} label="groups chosen" />
            <Tile value={RES.clusters.best_silhouette.toFixed(2)} label="best silhouette score. Below about 0.25 the structure is weak: districts differ by degree, not by type" />
          </dl>
        </Card>
      </div>
    </section>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 sm:p-6">
      <h3 className="text-[17px] font-semibold text-[var(--m-ink)]">{title}</h3>
      {note && <p className="mt-1 text-[13.5px] leading-6 text-[var(--m-ink-2)]">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Cell({ label, value, total, strong }: { label: string; value: number; total: number; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-3 text-center ${strong ? "bg-[var(--m-blue-200)]/50 text-[var(--m-ink)]" : "bg-[var(--m-surface)] text-[var(--m-ink-2)]"}`}>
      <div className="text-[11px] leading-tight">{label}</div>
      <div className="mt-1 font-[Georgia,serif] text-[20px] leading-none text-[var(--m-ink)] sm:text-[24px]">{n(value)}</div>
      <div className="mt-1 text-[11px]">{pct(value / total, 1)} of cases</div>
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[var(--m-surface)] px-3 py-3">
      <dt className="font-[Georgia,serif] text-[22px] leading-tight text-[var(--m-ink)]">{value}</dt>
      <dd className="mt-1 text-[12px] leading-snug text-[var(--m-ink-3)]">{label}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function Closing() {
  return (
    <section className="space-y-6 border-t border-[var(--m-line)] pt-12">
      <header>
        <p className="model-eyebrow">IN SHORT</p>
        <h2 className="mt-3 font-[Georgia,serif] text-[clamp(1.9rem,3.4vw,2.8rem)] leading-[1.1] tracking-[-.03em] text-[var(--m-ink)]">What this project did, and did not, show</h2>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Html html={NB.summary_html} className={`${PROSE} rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 sm:p-6`} />
        <div className="space-y-4">
          {NB.checks && (
            <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 sm:p-6">
              <p className="model-eyebrow">CROSS-CHECKED</p>
              <p className="mt-2 font-[Georgia,serif] text-[30px] leading-none text-[var(--m-ink)]">
                {NB.checks.agree} of {NB.checks.total}
              </p>
              <p className="mt-2 text-[14px] leading-6 text-[var(--m-ink-2)]">
                numbers recomputed in the notebook agree with the reports written by the pipeline scripts. The comparisons are printed inline above as <code className="rounded bg-[var(--m-blue-100)] px-1 font-mono text-[12.5px] text-[var(--m-ink)]">[agrees]</code> lines.
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 sm:p-6">
            <p className="model-eyebrow">THE NOTEBOOK</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--m-ink-2)]">
              Every step above is one section of a single executed Jupyter notebook, <code className="rounded bg-[var(--m-blue-100)] px-1 font-mono text-[12.5px] text-[var(--m-ink)]">00_full_pipeline.ipynb</code>, run top to bottom on {NB.generated}. It uses the project&apos;s own Python
              package and the cleaned data on disk; the slow steps (random forests, permutation importance) are read from the reports the training script wrote.
            </p>
            <a href={NOTEBOOK_FILE} download className="model-primary mt-4 inline-block">
              Download the .ipynb <span aria-hidden>↓</span>
            </a>
          </div>
          <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 sm:p-6">
            <p className="model-eyebrow">SETUP CELL</p>
            <p className="mt-2 mb-3 text-[14px] leading-6 text-[var(--m-ink-2)]">The imports and report files every later cell uses.</p>
            <PipelineCode code={NB.setup_code} label="Show the setup code" />
          </div>
        </div>
      </div>
      <p className="text-[13px] leading-6 text-[var(--m-ink-3)]">
        Data: Development Data Lab&apos;s judicial data (eCourts, filings 2010–2018), licence ODbL v1.0. A statistical summary of past Tamil Nadu cases, not a prediction for any real case and not legal advice.
      </p>
    </section>
  );
}
