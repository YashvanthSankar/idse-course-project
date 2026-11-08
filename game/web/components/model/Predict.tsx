"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { duration, getOptions, inTen, MONTHS, pct, predict, type Effect, type Kind, type Options, type Prediction, type Topic, type UsedInput } from "@/lib/model";
import { RealCase } from "./RealCase";

/** "Test the model": choose from dropdowns, press Analyze, and read everything the model did. */

const select = "h-11 w-full rounded-md border border-[#cfcabf] bg-white px-3 text-[15px] text-[var(--m-ink)]";

const SOURCE: Record<UsedInput["source"], string> = {
  you: "You chose this",
  case: "Set by the kind of case",
  data: "Looked up from court data",
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Percentage points this input moved the prediction, compared with an average case. */
function pointsMoved(p: number, effect: number): number {
  return (p - sigmoid(Math.log(p / (1 - p)) - effect)) * 100;
}

function usuallyTakes(timing: Kind["timing"]): string {
  if (timing.median_days === null) return "more than 4 years";
  if (timing.median_days <= 1) return "a day or two";
  return `about ${duration(timing.median_days)}`;
}

type Form = { topic: string; kind: string; district: string; month: number };

export function Predict() {
  const options = useQuery({ queryKey: ["model-options"], queryFn: getOptions, staleTime: Infinity, retry: 3 });
  if (options.isError)
    return (
      <div className="m-wrap m-page">
        <div className="m-panel">
          <p className="text-[var(--m-critical)]">Couldn&apos;t reach the model server.</p>
          <button type="button" className="m-btn mt-3" onClick={() => options.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!options.data) return <p className="m-wrap m-page text-[var(--m-ink-2)]">Loading the model…</p>;
  return <Tester opts={options.data} />;
}

function Tester({ opts }: { opts: Options }) {
  const kinds = Object.fromEntries(opts.kinds.map((k) => [k.id, k]));
  const first = opts.topics[0];
  const [form, setForm] = useState<Form>({ topic: first.id, kind: first.default_kind, district: "Chennai", month: 6 });
  const topic = opts.topics.find((t) => t.id === form.topic) ?? first;
  const [ran, setRan] = useState<{ form: Form; result: Prediction; ms: number } | null>(null);

  const analyze = useMutation({
    mutationFn: async (f: Form) => {
      const started = performance.now();
      const result = await predict(f.district, f.kind, f.month);
      return { form: f, result, ms: Math.round(performance.now() - started) };
    },
    retry: 3,
    retryDelay: 700,
    onSuccess: setRan,
  });
  const changed = ran && JSON.stringify(ran.form) !== JSON.stringify(form);

  return (
    <div className="m-wrap m-page">
      <header className="m-title">
        <h1>Will this case finish within a year?</h1>
        <p>Choose the case details and press Analyze. Our trained {opts.model_info.name.toLowerCase()} model scores the case and shows how it reached its answer.</p>
      </header>

      <div className="m-grid mt-6">
        <section className="m-panel" aria-label="Case details">
          <h2 className="m-h2 mb-4">Choose a case</h2>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.8fr)]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">What is the case about?</span>
              <select
                className={select}
                value={form.topic}
                data-testid="model-topic"
                onChange={(e) => {
                  const next = opts.topics.find((t) => t.id === e.target.value) as Topic;
                  setForm({ ...form, topic: next.id, kind: next.default_kind });
                }}
              >
                {opts.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[13px] text-[var(--m-ink-3)]">{topic.about}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Type of case and court</span>
              <select className={select} value={form.kind} data-testid="model-variant" onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {topic.kinds.map((id, i) => (
                  <option key={id} value={id}>
                    {kinds[id].variant}
                    {kinds[id].title !== topic.title ? `, ${kinds[id].title}` : ""}
                    {i === 0 ? " (most common)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">District in Tamil Nadu</span>
              <select className={select} value={form.district} data-testid="model-district" onChange={(e) => setForm({ ...form, district: e.target.value })}>
                {opts.districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Month filed</span>
              <select className={select} value={form.month} data-testid="model-month" onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" onClick={() => analyze.mutate(form)} disabled={analyze.isPending} data-testid="model-analyze" className="m-btn w-full sm:w-auto">
            {analyze.isPending ? "Running the model…" : "Analyze this case"}
          </button>
          {analyze.isError && <p className="mt-3 text-[var(--m-critical)]">The model didn&apos;t answer. Please press Analyze again.</p>}
          {changed && !analyze.isPending && <p className="mt-3 text-sm font-medium">You changed the details. Press Analyze to update the result below.</p>}
        </section>

      </div>

      {ran && (
        <div className="mt-3">
          <Result r={ran.result} ms={ran.ms} topic={opts.topics.find((t) => t.id === ran.form.topic) as Topic} stale={!!changed} />
        </div>
      )}

      <div className="mt-3">
        <RealCase topics={Object.fromEntries(opts.topics.map((t) => [t.id, t]))} testN={opts.test.n} testAccuracy={opts.test.accuracy} />
      </div>

      <p className="mt-6 text-sm text-[var(--m-ink-3)]">{opts.notice}</p>
    </div>
  );
}

function Panel({ title, tag, children, inner, wide }: { title: string; tag?: string; children: React.ReactNode; inner?: boolean; wide?: boolean }) {
  const Box = inner ? "div" : "section";
  return (
    <Box className={wide ? "m-wide" : undefined}>
      <div className="mb-3">
        <h3 className="m-h2">{title}</h3>
        {tag && <p className="text-[13px] text-[var(--m-ink-3)]">{tag}</p>}
      </div>
      {children}
    </Box>
  );
}

function Result({ r, ms, topic, stale }: { r: Prediction; ms: number; topic: Topic; stale: boolean }) {
  const p = r.probability;
  const yes = p >= 0.5;
  const info = r.model_info;
  const sure = p >= 0.8 || p <= 0.2 ? "The model is fairly confident." : p > 0.35 && p < 0.65 ? "This one is close to a coin flip." : "The model leans this way, but not strongly.";
  const trust = info.trust.by_type[r.kind.case_type] ?? info.trust.contested;
  const gain = trust.accuracy - trust.majority_accuracy;
  const moved = r.effects
    .map((e: Effect) => ({ ...e, points: pointsMoved(p, e.effect) }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const maxMoved = Math.max(...moved.map((m) => Math.abs(m.points)), 1);
  const value = Object.fromEntries(r.used_inputs.map((u) => [u.input, u.value]));
  const compare = [
    { label: `This case (model's prediction, ${r.district})`, value: p, main: true },
    { label: `All "${topic.title}" cases of this kind, Tamil Nadu 2017`, value: r.kind.within_1y_2017, main: false },
    { label: "All Tamil Nadu cases, 2017", value: info.base_rate, main: false },
  ];
  return (
    <article className="m-result" data-stale={stale} data-testid="model-answer" aria-live="polite">
      <header>
        <p className="text-sm text-[var(--m-ink-2)]">
          {topic.title} · {r.kind.variant} · {r.district}
        </p>
        <p className="m-verdict" data-testid="model-verdict">
          {yes ? "Likely to finish within 1 year" : "Not likely to finish within 1 year"}
        </p>
        <p className="m-probability" data-testid="model-probability">
          {pct(p)}
        </p>
        <p className="mt-1 text-[var(--m-ink-2)]">probability it is over within 1 year. {sure}</p>
        <div className="relative mt-4 h-2.5 rounded-full bg-[var(--m-blue-100)]">
          <div className="h-2.5 rounded-full bg-[var(--m-tape)]" style={{ width: `${p * 100}%` }} />
          <div className="absolute -top-1 left-1/2 h-[18px] w-0.5 bg-[var(--m-ink)]" aria-hidden />
        </div>
        <p className="mt-1 text-center text-[13px] text-[var(--m-ink-3)]">50% is the line between &ldquo;likely&rdquo; and &ldquo;not likely&rdquo;</p>
      </header>

      <section className="space-y-6">
      <Panel inner title="How much to trust this answer">
        <p data-testid="model-trust">
          For {r.kind.case_type_name.split(" (")[0].toLowerCase().replace(/ case$/, "")} cases like this, the model was right <b>{pct(trust.accuracy, 1)}</b> of the time on unseen 2017 cases. Always guessing the commonest answer gets{" "}
          <b>{pct(trust.majority_accuracy, 1)}</b>.
        </p>
        <p className="mt-1 text-sm text-[var(--m-ink-2)]">
          {gain >= 0.05
            ? "So the model adds real information for this kind of case."
            : gain >= 0
              ? "So for this kind of case it adds little beyond knowing the kind of case. Treat the exact percentage as a rough guide."
              : "So for this kind of case it does no better than always guessing. Treat the exact percentage as a rough guide."}
        </p>
      </Panel>

      <Panel inner title="How this compares" tag="share over within 1 year">
        <ul className="space-y-2">
          {compare.map((c) => (
            <li key={c.label} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] sm:items-center sm:gap-3">
              <span className={`text-sm ${c.main ? "font-semibold" : "text-[var(--m-ink-2)]"}`}>{c.label}</span>
              <span className="h-2 rounded-full bg-[var(--m-blue-100)]">
                <span className="block h-2 rounded-full" style={{ width: `${c.value * 100}%`, background: c.main ? "var(--m-tape)" : "var(--m-s5)" }} />
              </span>
              <span className="text-sm font-semibold tabular-nums sm:text-right">{pct(c.value)}</span>
            </li>
          ))}
        </ul>
      </Panel>
      </section>

      <Panel title="Why the model said this" tag="points each input added or removed, compared with an average case">
        <ul className="space-y-1" data-testid="model-reasons">
          {moved.slice(0, 6).map((m) => {
            const w = (Math.abs(m.points) / maxMoved) * 50;
            return (
              <li key={m.input} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm">
                <span className="min-w-0 break-words">
                  <span className="font-medium">{m.label}</span> <span className="text-[var(--m-ink-2)]">{value[m.input] ?? ""}</span>
                </span>
                <span className="relative h-3.5">
                  <span className="absolute left-1/2 top-0 h-3.5 w-px bg-[var(--m-ink-3)]" />
                  <span className="absolute top-0 h-3.5 rounded-sm" style={{ width: `${w}%`, left: m.points >= 0 ? "50%" : `${50 - w}%`, background: m.points >= 0 ? "var(--m-ink)" : "var(--m-tape)" }} />
                </span>
                <span className="text-right tabular-nums">
                  {m.points >= 0 ? "+" : "−"}
                  {Math.abs(m.points).toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="What the data says about timing" tag="from past cases, not the model's prediction">
        <p>
          Cases of this kind usually took <b>{usuallyTakes(r.kind.timing)}</b>, based on {r.kind.timing.cases.toLocaleString("en-IN")} Tamil Nadu cases filed in 2015–2018.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["6", "6 months"],
              ["12", "1 year"],
              ["24", "2 years"],
              ["36", "3 years"],
            ] as const
          ).map(([m, label]) => (
            <div key={m} className="rounded-md bg-[var(--m-surface)] p-3">
              <p className="text-[13px] text-[var(--m-ink-2)]">Still open after {label}</p>
              <p className="text-lg font-semibold tabular-nums">{inTen(r.kind.timing.still_open[m] ?? 0)}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel wide title="Exactly what was sent to the model" tag={`${r.used_inputs.length} inputs`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums" data-testid="model-inputs">
            <thead>
              <tr className="text-[var(--m-ink-3)]">
                <th className="py-1.5 pr-4 font-normal">Input</th>
                <th className="py-1.5 pr-4 font-normal">Value</th>
                <th className="py-1.5 font-normal">Where it came from</th>
              </tr>
            </thead>
            <tbody>
              {r.used_inputs.map((u) => (
                <tr key={u.input} className="border-b border-[var(--m-line)]">
                  <td className="py-1.5 pr-4">{u.label}</td>
                  <td className="py-1.5 pr-4 font-medium">{u.value}</td>
                  <td className="py-1.5 text-[var(--m-ink-2)]">{SOURCE[u.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.court && <p className="mt-2 text-[13px] text-[var(--m-ink-3)]">Court workload is the value at the end of the data ({r.court.cutoff}).</p>}
      </Panel>

      <Panel wide title="The model that answered">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Model", `${info.name} (${info.library})`],
            ["Predicts", info.target],
            ["Trained on", `${info.train_cases.toLocaleString("en-IN")} cases filed in ${info.train_years.join(" and ")}`],
            ["Tested on", `${info.test_cases.toLocaleString("en-IN")} cases filed in ${info.test_year}, never seen in training`],
            ["Accuracy, all test cases", pct(info.metrics.accuracy, 1)],
            ["Accuracy on real disputes", `${pct(info.trust.contested.accuracy, 1)} (always guessing: ${pct(info.trust.contested.majority_accuracy, 1)})`],
            ["AUC (0.5 = coin flip, 1 = perfect)", info.metrics.auc.toFixed(3)],
            ["Answered in", `${ms} ms, live from the deployed model`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[var(--m-ink-3)]">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </article>
  );
}
