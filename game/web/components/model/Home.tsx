"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { duration, getAnalytics, getOptions, pct } from "@/lib/model";
import { TreeScene } from "./TreeScene";

/** The first screen: why this exists, what it found, what data and model it uses. */

const DATA_STEPS = ["Collect the records", "Clean the mess", "Label each case", "Explore the data"];
const ML_STEPS = ["Choose the inputs", "Split by year", "Train and compare", "Test on unseen cases", "Deploy"];

function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--m-ink-3)]">{title}</h3>
      <ol className="mt-3 flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="rounded-lg border border-[var(--m-line)] bg-[var(--m-card)] px-3 py-2 text-sm">{s}</span>
            {i < steps.length - 1 && (
              <span aria-hidden className="text-[var(--m-ink-3)]">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Card({ title, big, text }: { title: string; big: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--m-ink-3)]">{title}</p>
      <p className="mt-2 text-xl font-bold">{big}</p>
      <p className="mt-2 text-sm text-[var(--m-ink-2)]">{text}</p>
    </div>
  );
}

export function Home() {
  const options = useQuery({ queryKey: ["model-options"], queryFn: getOptions, staleTime: Infinity, retry: 3 });
  const analytics = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity, retry: 3 });
  const info = options.data?.model_info;
  const a = analytics.data;
  const stages = a?.difficulty.stages.contested;
  const fast = a ? [...a.topics].sort((x, y) => y.within_1y - x.within_1y)[0] : null;
  const slow = a ? [...a.topics].sort((x, y) => x.within_1y - y.within_1y)[0] : null;
  const after = stages ? Math.round((stages.median_after_first_hearing / (stages.median_after_first_hearing + stages.median_wait_first_hearing)) * 100) : null;
  return (
    <div className="model-landing">
      <section className="tree-hero">
        <div className="tree-hero-copy">
          <p className="model-eyebrow">IDSE COURSE PROJECT · DATA ANALYSIS + MACHINE LEARNING</p>
          <h1>Which court cases get stuck, and can you tell on day one?</h1>
          <p>Indian courts are known for delay. We analysed real court records and trained a model to find which cases get stuck, where, and how much can be known on the day a case is filed.</p>
          <div className="model-hero-actions">
            <Link href="/model/explore" className="model-primary">
              Test the model <span aria-hidden>→</span>
            </Link>
            <Link href="/model/pipeline" className="model-secondary">
              See the pipeline <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
        <TreeScene />
      </section>

      <section className="mt-10" aria-labelledby="found">
        <h2 id="found" className="text-2xl font-bold">
          What we found
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <Card
            title="The kind of case decides most"
            big={fast && slow ? `${pct(fast.within_1y)} vs ${pct(slow.within_1y)}` : "…"}
            text={fast && slow ? `${fast.title} cases are over within a year ${pct(fast.within_1y)} of the time. ${slow.title} cases: ${pct(slow.within_1y)}.` : ""}
          />
          <Card
            title="Real disputes are hard to call"
            big={info ? `${pct(info.trust.contested.accuracy, 1)} vs ${pct(info.trust.contested.majority_accuracy, 1)}` : "…"}
            text={info ? `The model is ${pct(info.metrics.accuracy, 1)} accurate overall, mostly on petty cases. On real disputes it barely beats always guessing "not within a year".` : ""}
          />
          <Card
            title="The time comes after the start"
            big={after !== null ? `${after}% after the first hearing` : "…"}
            text={stages ? `A real dispute gets its first hearing after a median of ${Math.round(stages.median_wait_first_hearing)} days, then runs ${duration(stages.median_after_first_hearing)} more.` : ""}
          />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="why">
        <h2 id="why" className="text-2xl font-bold">
          Who this helps
        </h2>
        <p className="mt-2 max-w-3xl text-[var(--m-ink-2)]">
          It is a planning tool, not a prediction for one person&apos;s case. A court registry can estimate how many new cases will still be open a year later. Legal-aid offices can see which kinds of case are worth steering towards mediation, and
          anyone can see which districts and stages to look at first.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="built">
        <h2 id="built" className="text-2xl font-bold">
          What we built it from
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card
            title="The data"
            big={a ? `${(a.national.cases / 1e6).toFixed(1)} million court cases` : "…"}
            text={a ? `Real Indian district-court records filed 2010–2018, from the government's eCourts system, with names removed. One row per case. ${(a.tamil_nadu.cases / 1e6).toFixed(2)} million Tamil Nadu cases were cleaned for the model.` : ""}
          />
          <Card
            title="The model"
            big={info?.name ?? "…"}
            text={info ? `Predicts whether a case will be over within a year. Trained on ${info.train_cases.toLocaleString("en-IN")} cases filed in ${info.train_years.join(" and ")}, using ${info.n_inputs} inputs known on filing day, and tested on ${info.test_cases.toLocaleString("en-IN")} cases filed in ${info.test_year}.` : ""}
          />
        </div>
      </section>

      <section className="mt-10 space-y-5" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-bold">
          How it was made
        </h2>
        <Steps title="Data analysis pipeline" steps={DATA_STEPS} />
        <Steps title="Machine-learning pipeline" steps={ML_STEPS} />
        <Link href="/model/pipeline" className="inline-block font-medium text-[var(--m-s1)] underline">
          See every step, with the code and results →
        </Link>
      </section>

      <section className="mt-10 grid gap-3 pb-6 sm:grid-cols-3" aria-label="Where to go next">
        {[
          { href: "/model/explore", title: "Test the model", text: "Choose a case and district, press Analyze, and see the prediction and how far to trust it." },
          { href: "/model/pipeline", title: "See the pipeline", text: "Every step from raw court records to the deployed model." },
          { href: "/model/analytics", title: "Data analysis", text: "Which case types and districts are slow, and where disputes get stuck." },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5 hover:border-[var(--m-s1)]">
            <p className="text-lg font-semibold">
              {l.title} <span aria-hidden>→</span>
            </p>
            <p className="mt-1 text-sm text-[var(--m-ink-2)]">{l.text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
