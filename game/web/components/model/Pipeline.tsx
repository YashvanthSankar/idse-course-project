import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import notebookJson from "@/public/pipeline/notebook.json";
import resultsJson from "@/public/pipeline/results.json";
import { CalibrationChart, Table } from "./Charts";
import { PipelineCode } from "./PipelineCode";
import { PipelineIndex } from "./PipelineIndex";

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
type Group = { n: number; accuracy: number; majority_accuracy: number; auc: number };

type Results = {
  difficulty: { all: Group; easy: Group; contested: Group; contested_only_models: Record<string, { auc: number; accuracy: number }> };
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
  "max-w-[72ch] space-y-3 text-[16px] leading-7 text-[var(--m-ink-2)] [&_strong]:font-semibold [&_strong]:text-[var(--m-ink)] [&_em]:text-[var(--m-ink)] " +
  "[&_code]:rounded [&_code]:bg-[var(--m-blue-100)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13.5px] [&_code]:text-[var(--m-ink)] " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_li]:pl-1 [&_blockquote]:pl-4 [&_blockquote]:text-[var(--m-ink)] [&_a]:underline " +
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px] [&_table]:leading-5 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-normal [&_th]:text-[var(--m-ink-3)] " +
  "[&_td]:border-t [&_td]:border-[var(--m-line)] [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top";

/* pandas tables printed by the notebook. */
const DATAFRAME =
  "num-table overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px] [&_table]:leading-5 [&_table]:tabular-nums " +
  "[&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-normal [&_th]:text-[var(--m-ink-3)] " +
  "[&_td]:min-w-[5rem] [&_td]:border-t [&_td]:border-[var(--m-line)] [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-[var(--m-ink-2)] [&_tbody_th]:border-t [&_tbody_th]:border-[var(--m-line)] [&_tbody_th]:text-[var(--m-ink)]";

/* The notebook's own bookkeeping: the 'Takeaway:' line is shown on its own, and cross-check lines
   are summed up at the end of the page. */
const readable = (text: string) =>
  text
    .split("\n")
    .filter((l) => !/^\s*\[(agrees|DISAGREES)\]/.test(l) && !l.startsWith("Takeaway:"))
    .join("\n")
    .trim();

function Html({ html, className }: { html: string; className: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

const shortTitle = (t: string) => t.replace(/^Side analysis: /, "").split(/[:(]/)[0].replace(/\?$/, "").trim();
const sentence = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ------------------------------------------------------------------------------------------ */

export function Pipeline() {
  const served = RES.models.find((m) => m.served)!;
  const lookup = RES.models.find((m) => m.name.includes("district"))!;
  const stages = NB.parts.flatMap((p) => p.stages);
  const groups = NB.parts.map((p) => ({ id: p.id, title: p.title, stages: p.stages.map((s) => ({ id: s.id, title: shortTitle(s.title) })) }));
  return (
    <div className="m-wrap m-page">
      <Hero served={served} stageCount={stages.length} />
      <div className="reader">
        <PipelineIndex groups={groups} extra={[{ id: "results", title: "Results on unseen cases" }, { id: "in-short", title: "In short" }]} />
        <div className="min-w-0">
          {NB.parts.map((part) => (
            <section key={part.id} id={`part-${part.id}`} className="mb-10">
              <h2 className="part-title">{part.title}</h2>
              <p className="mb-6 mt-3 max-w-[72ch] text-[var(--m-ink-2)]">{PART_BLURB[part.id]}</p>
              {part.stages.map((stage) => (
                <StageCard key={stage.id} stage={stage} />
              ))}
              {part.id === "A" && <Handoff />}
            </section>
          ))}
          <ResultsSection served={served} lookup={lookup} />
          <Closing />
        </div>
      </div>
    </div>
  );
}

function Hero({ served, stageCount }: { served: Metric; stageCount: number }) {
  return (
    <header className="m-title">
      <h1>From 81 million court records to one tested model</h1>
      <p>
        The whole project in {stageCount} steps, in the order the work was done. Each step says what was done, why, and what came out, with the exact code behind it. Written from one executed notebook, which you can download.
      </p>
      <div className="m-actions">
        <a href={NOTEBOOK_FILE} download className="m-btn">
          Download the notebook
        </a>
        <a href="#results" className="m-btn-2">
          Jump to the results
        </a>
        <Link href="/model/explore" className="m-btn-2">
          Try the model
        </Link>
      </div>
      <dl className="m-kpis mt-6 [&_.m-kpi-value]:!text-[26px]">
        <Stat value={`${(RES.cases.national / 1e6).toFixed(1)} million`} label="court cases in the download, all India" />
        <Stat value={`${(RES.cases.tamil_nadu / 1e6).toFixed(2)} million`} label="Tamil Nadu cases cleaned and labelled" />
        <Stat value={n(RES.model_info.train_cases)} label={`cases the model learned from, filed ${RES.train_years.join("–")}`} />
        <Stat value={n(served.n)} label={`cases it was tested on, filed in ${RES.test_year}`} />
        <Stat value={pct(RES.difficulty.contested.accuracy, 1)} label={`accurate on real disputes, vs ${pct(RES.difficulty.contested.majority_accuracy, 1)} for always guessing`} />
      </dl>
    </header>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="m-kpi-value">{value}</dd>
      <dt className="m-kpi-label">{label}</dt>
    </div>
  );
}

function Handoff() {
  const years = Object.entries(RES.within_1y_by_year);
  return (
    <p className="takeaway">
      <b>What this part hands to the next</b>
      One table of Tamil Nadu cases filed 2015–2017 with an honest &ldquo;disposed of within a year&rdquo; label:{" "}
      {years.map(([y, v], i) => (
        <span key={y}>
          {i > 0 && (i === years.length - 1 ? " and " : ", ")}
          {pct(v)} of {y} filings
        </span>
      ))}
      . Cases with impossible dates were set aside, cases that moved to another court count as not finished, and every case was watched for at least a year.
    </p>
  );
}

/* ------------------------------------------------------------------------------------------ */

function StageCard({ stage }: { stage: Stage }) {
  const blocks = stage.cells.flatMap((c) => c.blocks);
  const images = blocks.filter((b) => b.type === "image");
  const printed = blocks.flatMap((b): Block[] => {
    if (b.type === "image") return [];
    if (b.type === "table") return [b];
    const text = readable(b.text);
    return text ? [{ type: "text", text }] : [];
  });
  /* A step with no chart shows its first table in the open; everything else folds. */
  const lead = images.length === 0 ? printed.find((b) => b.type === "table") : undefined;
  const rest = printed.filter((b) => b !== lead);
  return (
    <article id={stage.id} className="stage">
      <h3 className="stage-title">
        <span>{stage.id}</span>
        {stage.title}
      </h3>
      <Html html={stage.intro_html} className={`${PROSE} mt-3`} />
      <p className="takeaway">
        <b>What came out</b>
        {sentence(stage.takeaway)}
      </p>
      {images.length > 0 && (
        <div className="stage-figures" data-count={images.length}>
          {images.map((b) =>
            b.type === "image" ? (
              <figure key={b.src} className="stage-figure">
                <Image src={b.src} width={b.width} height={b.height} alt={`Chart from step ${stage.id}: ${stage.title}`} unoptimized className="h-auto w-full" />
              </figure>
            ) : null,
          )}
        </div>
      )}
      {lead && lead.type === "table" && (
        <div className="stage-figure mt-4">
          <Html html={lead.html} className={DATAFRAME} />
        </div>
      )}
      {rest.length > 0 && (
        <details className="fold mt-4">
          <summary>
            <span>Show what the notebook printed</span>
          </summary>
          <div className="fold-body space-y-3">
            {rest.map((b, i) =>
              b.type === "table" ? (
                <Html key={i} html={b.html} className={DATAFRAME} />
              ) : b.type === "text" ? (
                <pre key={i} className="whitespace-pre-wrap font-mono text-[13px] leading-[1.6] text-[var(--m-ink-2)] [overflow-wrap:anywhere]">
                  {b.text}
                </pre>
              ) : null,
            )}
          </div>
        </details>
      )}
      {stage.cells.map((c, i) => (
        <PipelineCode key={i} code={c.code} label={stage.cells.length > 1 ? `Show the code (cell ${i + 1})` : "Show the code that produced this"} />
      ))}
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
    <section id="results" className="m-grid scroll-mt-4 border-t border-[var(--m-line)] pt-10">
      <header className="mb-3">
        <h2 className="part-title">How it did on {n(served.n)} unseen cases</h2>
        <p className="mt-3 max-w-[72ch] text-[var(--m-ink-2)]">
          Every model was fitted on cases filed in {RES.train_years.join(" and ")} and scored once on cases filed in {RES.test_year}. The served model is {served.name.replace(/, with law and section$/, " with the law and section inputs")}, chosen before the {RES.test_year} cases were looked at. Accuracy is how often its yes/no call was right. AUC is how well it ranks a finished case above an unfinished one (0.5 is a coin toss). Brier and log loss measure how far its probabilities were from what happened (lower is better).
        </p>
      </header>

      <Card
        title="Read this first: most of the accuracy is easy cases"
        note="Petty summary trials and bail-type petitions are almost always over within a year. Each group is compared with the simplest possible rule: always guess the commonest answer for that group."
      >
        <div className="overflow-x-auto">
          <table className="num-table w-full border-collapse text-left text-[13.5px] tabular-nums" data-testid="pipeline-difficulty">
            <thead>
              <tr className="text-[var(--m-ink)]">
                {["Group", "Cases", "Model accuracy", "Always guessing", "AUC"].map((h) => (
                  <th key={h} className="whitespace-nowrap py-2 pr-4 font-normal text-[var(--m-ink-3)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["All 2017 test cases", RES.difficulty.all],
                  ["Easy: summary trials and bail-type petitions", RES.difficulty.easy],
                  ["Real disputes (everything else)", RES.difficulty.contested],
                ] as const
              ).map(([label, g], i) => (
                <tr key={label} className={i === 2 ? "font-semibold text-[var(--m-ink)]" : "text-[var(--m-ink-2)]"}>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{label}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{n(g.n)}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{pct(g.accuracy, 1)}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{pct(g.majority_accuracy, 1)}</td>
                  <td className="border-b border-[var(--m-line)] py-2 pr-4">{g.auc.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] leading-6 text-[var(--m-ink-2)]">
          Training a model on real disputes alone barely changes this (best AUC {Math.max(...Object.values(RES.difficulty.contested_only_models).map((m) => m.auc)).toFixed(2)}), so the limit is what can be known on filing day, not the
          algorithm.
        </p>
      </Card>

      <Card title="Model comparison" note={`Test year ${RES.test_year}. Bold row: the served model. The three baselines are what you get without any machine learning.`}>
        <div className="overflow-x-auto">
          <table className="num-table-3 w-full border-collapse text-left text-[13.5px] tabular-nums">
            <thead>
              <tr className="text-[var(--m-ink)]">
                {["Model", "Inputs", "Accuracy", "AUC", "Brier", "Log loss"].map((h) => (
                  <th key={h} className="whitespace-nowrap py-2 pr-4 font-normal text-[var(--m-ink-3)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RES.models.map((m) => (
                <tr key={m.name} className={m.served ? "bg-[var(--m-buff-pale)] font-semibold text-[var(--m-ink)]" : "text-[var(--m-ink-2)]"}>
                  <td className="min-w-[9rem] border-b border-[var(--m-line)] py-2 pr-4">
                    {m.name.split(",")[0]}
                    {m.served && <span className="ml-2 rounded bg-[var(--m-tape)] px-1.5 py-px text-[12px] font-medium text-white">served</span>}
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

      <div className="m-grid lg:grid-cols-2">
        <Card title="Confusion matrix" note={`${RES.test_year} test cases, calling "within a year" when the probability is at least 50%.`}>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-[13px]">
            <div />
            <div className="pb-1 text-center text-[12px] leading-tight text-[var(--m-ink-3)]">
              predicted:
              <br />
              not within a year
            </div>
            <div className="pb-1 text-center text-[12px] leading-tight text-[var(--m-ink-3)]">
              predicted:
              <br />
              within a year
            </div>
            <div className="flex items-center pr-2 text-right text-[12px] leading-tight text-[var(--m-ink-3)]">
              actually
              <br />
              not within
            </div>
            <Cell label="true negative" value={c.tn} total={total} strong />
            <Cell label="false positive" value={c.fp} total={total} />
            <div className="flex items-center pr-2 text-right text-[12px] leading-tight text-[var(--m-ink-3)]">
              actually
              <br />
              within
            </div>
            <Cell label="false negative" value={c.fn} total={total} />
            <Cell label="true positive" value={c.tp} total={total} strong />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
            {[
              ["Accuracy", pct(c.accuracy, 1), "right overall"],
              ["Precision", pct(c.precision, 1), "when it says yes, how often right"],
              ["Recall", pct(c.recall, 1), "of the cases that did finish, how many it called"],
            ].map(([k, v, note]) => (
              <div key={k}>
                <dt className="text-[13px] text-[var(--m-ink-3)]">{k}</dt>
                <dd className="font-[family-name:var(--m-display)] text-[22px] text-[var(--m-ink)]">{v}</dd>
                <dd className="text-[13px] leading-snug text-[var(--m-ink-2)]">{note}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Is a predicted 70% really 70%?" note="Cases grouped by predicted probability; each dot compares the group's average prediction with the share that really finished within a year. On the dashed line = honest probabilities.">
          <CalibrationChart points={RES.calibration.map((x) => ({ predicted: x.mean_predicted, observed: x.observed, cases: x.cases }))} />
        </Card>
      </div>

      <div className="m-grid lg:grid-cols-2">
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

      <div className="m-grid sm:grid-cols-2">
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
    <section className="m-panel">
      <h3 className="m-h2">{title}</h3>
      {note && <p className="m-note">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Cell({ label, value, total, strong }: { label: string; value: number; total: number; strong?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-3 text-center ${strong ? "bg-[var(--m-buff-pale)] text-[var(--m-ink)]" : "bg-[var(--m-surface)] text-[var(--m-ink-2)]"}`}>
      <div className="text-[12px] leading-tight">{label}</div>
      <div className="mt-1 font-[family-name:var(--m-display)] text-[20px] leading-none text-[var(--m-ink)] sm:text-[24px]">{n(value)}</div>
      <div className="mt-1 text-[12px]">{pct(value / total, 1)} of cases</div>
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[var(--m-surface)] px-3 py-3">
      <dt className="font-[family-name:var(--m-display)] text-[22px] leading-tight text-[var(--m-ink)]">{value}</dt>
      <dd className="mt-1 text-[13px] leading-snug text-[var(--m-ink-2)]">{label}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

function Closing() {
  return (
    <section id="in-short" className="mt-12 border-t border-[var(--m-line)] pt-10">
      <h2 className="part-title">What this project did, and did not, show</h2>
      <Html html={NB.summary_html} className={`${PROSE} mt-5`} />
      <div className="m-grid mt-6 md:grid-cols-2">
        {NB.checks && (
          <div className="m-panel">
            <h3 className="m-h2">Cross-checked</h3>
            <p className="m-kpi-value mt-2">
              {NB.checks.agree} of {NB.checks.total}
            </p>
            <p className="m-note">numbers recomputed in the notebook agree with the reports written by the pipeline scripts.</p>
          </div>
        )}
        <div className="m-panel">
          <h3 className="m-h2">The notebook</h3>
          <p className="m-note">Every step above is one section of a single executed Jupyter notebook, run top to bottom on {NB.generated}. The slow steps (random forests, permutation importance) are read from the reports the training script wrote.</p>
          <a href={NOTEBOOK_FILE} download className="m-btn mt-3">
            Download the .ipynb
          </a>
        </div>
      </div>
      <div className="mt-3">
        <PipelineCode code={NB.setup_code} label="Show the setup code" />
      </div>
      <p className="mt-6 text-[13px] leading-6 text-[var(--m-ink-3)]">Data: Development Data Lab&apos;s judicial data (eCourts, filings 2010–2018), licence ODbL v1.0. A statistical summary of past Tamil Nadu cases, not a prediction for any real case and not legal advice.</p>
    </section>
  );
}
