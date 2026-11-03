"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { duration, getOptions, getSample, inTen, outOf10, predict, type Effect, type Kind, type Options, type Prediction, type Sample, type Topic } from "@/lib/model";

/** "Check a case": two plain questions (what is it about? where?) and a plain answer. */

const MONTH = 6; // the filing month barely matters (measured), so the page doesn't ask

const MILESTONES: [string, string][] = [
  ["6", "6 months"],
  ["12", "1 year"],
  ["24", "2 years"],
  ["36", "3 years"],
];

const COURT_PLAIN: Record<string, string> = {
  "Magistrate court": "magistrate courts",
  "District / sessions judge": "district courts",
  "Sub court (subordinate judge)": "sub courts",
  "Munsif court": "munsif courts",
  "Small cause court": "small causes courts",
};

function usuallyTakes(timing: Kind["timing"]): { headline: string; detail: string } {
  if (timing.median_days === null) {
    return { headline: "more than 4 years", detail: "More than half of these cases were still not finished 4 years after they were filed." };
  }
  if (timing.median_days <= 1) return { headline: "a day or two", detail: "Half of these cases were finished within a day or two of being filed." };
  return { headline: `about ${duration(timing.median_days)}`, detail: "Half of these cases had finished by then; the other half took longer." };
}

function Dots({ filled }: { filled: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`inline-block h-6 w-6 rounded-full ${i < filled ? "bg-[var(--m-s1)]" : "bg-[var(--m-line)]"}`} />
      ))}
    </span>
  );
}

export function Predict() {
  const options = useQuery({ queryKey: ["model-options"], queryFn: getOptions, staleTime: Infinity });
  if (options.isError)
    return (
      <p className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 text-[var(--m-critical)]">
        Couldn&apos;t reach the model server. Please reload the page in a minute.
      </p>
    );
  if (!options.data) return <p className="text-[var(--m-ink-2)]">Loading…</p>;
  return <Checker opts={options.data} />;
}

function Checker({ opts }: { opts: Options }) {
  const kinds = Object.fromEntries(opts.kinds.map((k) => [k.id, k]));
  const [topicId, setTopicId] = useState(opts.topics[0].id);
  const topic = opts.topics.find((t) => t.id === topicId) ?? opts.topics[0];
  const [variant, setVariant] = useState<Record<string, string>>({});
  const kindId = variant[topic.id] ?? topic.default_kind;
  const [district, setDistrict] = useState("Chennai");
  const [other, setOther] = useState("");

  const result = useQuery({ queryKey: ["model-predict", district, kindId], queryFn: () => predict(district, kindId, MONTH) });
  const compare = useQuery({
    queryKey: ["model-predict", other, kindId],
    queryFn: () => predict(other, kindId, MONTH),
    enabled: !!other,
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How long will a court case take?</h1>
        <p className="mt-2 max-w-2xl text-lg text-[var(--m-ink-2)]">
          Answered from 3.6 million real cases in Tamil Nadu&apos;s district courts. Pick what the case is about and where it was filed.
        </p>
      </section>

      <section aria-labelledby="q1">
        <h2 id="q1" className="mb-3 text-lg font-semibold">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--m-s1)] text-sm text-white">1</span>
          What is the case about?
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="What is the case about?">
          {opts.topics.map((t) => {
            const on = t.id === topic.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTopicId(t.id)}
                data-testid={`topic-${t.id}`}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${on ? "border-[var(--m-s1)] bg-[var(--m-blue-100)]" : "border-[var(--m-line)] bg-[var(--m-card)] hover:border-[var(--m-blue-200)]"}`}
              >
                <span className="block text-2xl" aria-hidden>
                  {t.icon}
                </span>
                <span className="mt-1 block font-semibold leading-tight">{t.title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-[var(--m-ink-2)]">{t.about}</span>
              </button>
            );
          })}
        </div>
        {topic.kinds.length > 1 && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--m-ink-2)]">
            Most {topic.noun} go through this court and procedure. Change it if you know yours:
            <select
              className="rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-2 py-1 text-sm text-[var(--m-ink)]"
              value={kindId}
              onChange={(e) => setVariant({ ...variant, [topic.id]: e.target.value })}
              data-testid="model-variant"
            >
              {topic.kinds.map((id) => (
                <option key={id} value={id}>
                  {kinds[id].variant}
                  {kinds[id].title !== topic.title ? ` (${kinds[id].title})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section aria-labelledby="q2">
        <h2 id="q2" className="mb-3 text-lg font-semibold">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--m-s1)] text-sm text-white">2</span>
          Which district?
        </h2>
        <select
          className="w-full max-w-xs rounded-lg border-2 border-[var(--m-line)] bg-[var(--m-card)] px-3 py-2 text-base"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          data-testid="model-district"
        >
          {opts.districts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </section>

      {result.isError && <p className="text-[var(--m-critical)]">Couldn&apos;t get an answer. Please try again.</p>}
      {result.data && (
        <Answer r={result.data} topic={topic} other={other} setOther={setOther} compare={compare.data} districts={opts.districts} />
      )}

      <RealCase opts={opts} />

      <p className="text-sm text-[var(--m-ink-3)]">{opts.notice}</p>
    </div>
  );
}

/** The model's effects grouped into the three things a person understands. */
function reasons(r: Prediction, topic: Topic): string[] {
  const sum = (inputs: string[]) => r.effects.filter((e: Effect) => inputs.includes(e.input)).reduce((a, e) => a + e.effect, 0);
  const kind = sum(["case_type", "law", "law_section", "ipc_bailable", "criminal", "n_ipc_sections", "court_level"]);
  const place = sum(["district"]);
  const busy = sum(["log_pending_at_filing", "clearance_last_year", "log_prev_year_filings"]);
  const noun = topic.noun[0].toUpperCase() + topic.noun.slice(1);
  const out = [
    kind < -0.3 ? `${noun} are one of the slower kinds of case.` : kind > 0.3 ? `${noun} are one of the quicker kinds of case.` : `${noun} move at about the average pace.`,
    place < -0.15
      ? `Courts in ${r.district} are slower than the Tamil Nadu average.`
      : place > 0.15
        ? `Courts in ${r.district} are quicker than the Tamil Nadu average.`
        : `Courts in ${r.district} are close to the Tamil Nadu average.`,
  ];
  if (r.court) {
    const courts = COURT_PLAIN[r.kind.court_level] ?? "courts";
    out.push(
      `${r.district}'s ${courts} had ${r.court.pending.toLocaleString("en-IN")} cases waiting at the end of the data` +
        (busy < -0.15 ? ", which slows new cases down." : busy > 0.15 ? ", and they were clearing them fairly quickly." : "."),
    );
  }
  return out;
}

function Answer({
  r,
  topic,
  other,
  setOther,
  compare,
  districts,
}: {
  r: Prediction;
  topic: Topic;
  other: string;
  setOther: (d: string) => void;
  compare?: Prediction;
  districts: string[];
}) {
  const takes = usuallyTakes(r.kind.timing);
  const n = outOf10(r.probability);
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)]" aria-live="polite" data-testid="model-answer">
      <div className="border-b border-[var(--m-line)] bg-[var(--m-blue-100)] px-5 py-3 text-sm font-medium">
        {topic.icon} {topic.title} · {r.district}
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-[var(--m-ink-3)]">Cases like this usually take</p>
          <p className="mt-1 text-4xl font-bold" data-testid="model-takes">
            {takes.headline}
          </p>
          <p className="mt-2 text-[var(--m-ink-2)]">{takes.detail}</p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-[var(--m-ink-3)]">Chance it&apos;s over within a year</p>
          <p className="mt-1 text-4xl font-bold" data-testid="model-probability">
            {inTen(r.probability)}
          </p>
          <div className="mt-2">
            <Dots filled={n} />
          </div>
          <p className="mt-2 text-sm text-[var(--m-ink-2)]">
            For a case like this filed in {r.district}. &ldquo;Over&rdquo; means the court closed it: a judgment, a settlement or a dismissal.
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--m-line)] px-5 py-4">
        <p className="mb-2 text-sm font-semibold">Still not over after…</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MILESTONES.map(([m, label]) => {
            const open = r.kind.timing.still_open[m] ?? 0;
            return (
              <div key={m} className="rounded-lg bg-[var(--m-surface)] p-3">
                <p className="text-xs text-[var(--m-ink-3)]">{label}</p>
                <p className="text-lg font-semibold">{inTen(open)}</p>
                <div className="mt-1 h-1.5 rounded-full bg-[var(--m-line)]">
                  <div className="h-1.5 rounded-full bg-[var(--m-s1)]" style={{ width: `${open * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--m-ink-3)]">Across Tamil Nadu, for {r.kind.timing.cases.toLocaleString("en-IN")} such cases filed in 2015–2018.</p>
      </div>

      <div className="border-t border-[var(--m-line)] px-5 py-4">
        <p className="mb-2 text-sm font-semibold">Why</p>
        <ul className="space-y-1 text-[var(--m-ink)]" data-testid="model-reasons">
          {reasons(r, topic).map((s) => (
            <li key={s} className="flex gap-2">
              <span aria-hidden className="text-[var(--m-s1)]">
                •
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-[var(--m-line)] px-5 py-4">
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Is it quicker somewhere else?</span>
          <select
            className="rounded-md border border-[var(--m-line)] bg-[var(--m-card)] px-2 py-1"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            data-testid="model-compare"
          >
            <option value="">pick a district</option>
            {districts
              .filter((d) => d !== r.district)
              .map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </label>
        {compare && other && (
          <p className="mt-2" data-testid="model-compare-result">
            In <b>{compare.district}</b>: <b>{inTen(compare.probability)}</b> are over within a year, compared with {inTen(r.probability)} in {r.district}.
          </p>
        )}
      </div>
    </section>
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function RealCase({ opts }: { opts: Options }) {
  const [tally, setTally] = useState({ checked: 0, right: 0 });
  const [last, setLast] = useState<Sample | null>(null);
  const topics = Object.fromEntries(opts.topics.map((t) => [t.id, t]));
  const draw = useMutation({
    mutationFn: getSample,
    onSuccess: (s) => {
      setLast(s);
      setTally((t) => ({ checked: t.checked + 1, right: t.right + Number(s.probability >= 0.5 === s.actual.within_1y) }));
    },
  });
  const t = last ? (topics[last.case.topic] ?? null) : null;
  const right = last ? last.probability >= 0.5 === last.actual.within_1y : false;
  const [y, m] = last ? last.case.filed.split("-").map(Number) : [0, 0];
  return (
    <section className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold">Can the model guess right?</h2>
          <p className="text-[var(--m-ink-2)]">See its guess for a real case from 2017 that it never saw, then what really happened.</p>
        </div>
        <button
          type="button"
          onClick={() => draw.mutate()}
          disabled={draw.isPending}
          className="rounded-lg bg-[var(--m-s1)] px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
          data-testid="model-sample"
        >
          {last ? "Another case" : "Show me a real case"}
        </button>
      </div>
      {last && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="model-sample-result">
          <div className="rounded-lg bg-[var(--m-surface)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--m-ink-3)]">The case</p>
            <p className="mt-1 font-medium">{t ? `${t.icon} ${t.title}` : last.case.title}</p>
            <p className="text-sm text-[var(--m-ink-2)]">
              {last.case.district}, filed {MONTH_NAMES[m - 1]} {y}
            </p>
          </div>
          <div className="rounded-lg bg-[var(--m-surface)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--m-ink-3)]">The model guessed</p>
            <p className="mt-1 font-medium">{last.probability >= 0.5 ? "Probably over within a year" : "Probably not over within a year"}</p>
            <p className="text-sm text-[var(--m-ink-2)]">Chance: {inTen(last.probability)}</p>
          </div>
          <div className="rounded-lg bg-[var(--m-surface)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--m-ink-3)]">What really happened</p>
            <p className="mt-1 font-medium">
              {last.actual.ended
                ? last.actual.observed_days === 0
                  ? "Over the day it was filed"
                  : `Over after ${duration(last.actual.observed_days)}`
                : `Still not over after ${duration(last.actual.observed_days)}`}
            </p>
            <p className={`text-sm font-semibold ${right ? "text-[var(--m-good)]" : "text-[var(--m-critical)]"}`}>{right ? "✓ The model was right" : "✗ The model was wrong"}</p>
          </div>
          <p className="text-sm text-[var(--m-ink-3)] sm:col-span-3">
            Right {tally.right} of {tally.checked} times on this visit. Across all {opts.test.n.toLocaleString("en-IN")} cases it was tested on, it was
            right about {outOf10(opts.test.accuracy)} times in 10.
          </p>
        </div>
      )}
    </section>
  );
}
