"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getAnalytics, getOptions, pct } from "@/lib/model";
import { TreeScene } from "./TreeScene";

/** The first screen: what we trained, on what, how good it is, and where to test it. */

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

export function Home() {
  const options = useQuery({ queryKey: ["model-options"], queryFn: getOptions, staleTime: Infinity, retry: 3 });
  const analytics = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity, retry: 3 });
  const info = options.data?.model_info;
  const national = analytics.data?.national.cases;
  const tn = analytics.data?.tamil_nadu.cases;
  const cards = [
    { title: "The question", big: "Finished within 1 year?", text: "Given what is known on the day a case is filed in a Tamil Nadu district court, will it be over within one year?" },
    {
      title: "The data",
      big: national ? `${(national / 1e6).toFixed(1)} million cases` : "…",
      text: tn ? `Real Indian court records filed 2010–2018, from the government's eCourts system. ${(tn / 1e6).toFixed(2)} million Tamil Nadu cases were cleaned for the model.` : "",
    },
    {
      title: "The model",
      big: info?.name ?? "…",
      text: info ? `Trained on ${info.train_cases.toLocaleString("en-IN")} cases filed in ${info.train_years.join(" and ")}, using ${info.n_inputs} inputs. Chosen after comparing it with an SVM, a random forest and simple baselines.` : "",
    },
    {
      title: "How well it works",
      big: info ? `${pct(info.metrics.accuracy, 1)} accurate` : "…",
      text: info ? `Tested on ${info.test_cases.toLocaleString("en-IN")} cases filed in ${info.test_year} that it never saw while training.` : "",
    },
  ];
  return (
    <div className="model-landing">
      <section className="tree-hero">
        <div className="tree-hero-copy">
          <p className="model-eyebrow">IDSE COURSE PROJECT · DATA ANALYSIS + MACHINE LEARNING</p>
          <h1>Predicting how long court cases take</h1>
          <p>We trained a machine-learning model on real court records from Tamil Nadu. Give it a case, and it predicts whether the case will finish within one year.</p>
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

      <section className="mt-10" aria-labelledby="built">
        <h2 id="built" className="text-2xl font-bold">
          What we built
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--m-ink-3)]">{c.title}</p>
              <p className="mt-2 text-xl font-bold">{c.big}</p>
              <p className="mt-2 text-sm text-[var(--m-ink-2)]">{c.text}</p>
            </div>
          ))}
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
          { href: "/model/explore", title: "Test the model", text: "Choose a case and district, press Analyze, and see the prediction and how it was made." },
          { href: "/model/pipeline", title: "See the pipeline", text: "Every step from raw court records to the deployed model." },
          { href: "/model/analytics", title: "Data analysis", text: "What the data shows about case types, districts and backlogs." },
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
