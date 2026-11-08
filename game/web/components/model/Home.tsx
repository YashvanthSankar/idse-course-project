"use client";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import resultsJson from "@/public/pipeline/results.json";
import { duration, getOptions, pct } from "@/lib/model";
import { RealCase } from "./RealCase";

/** The first screen: the file cover, tied with the real timeline of a typical dispute. */

type Group = { n: number; accuracy: number; majority_accuracy: number };
const RES = resultsJson as unknown as {
  stages: { median_wait_first_hearing: number; median_after_first_hearing: number; median_gap_between_hearings: number };
  topic_extremes: { fastest: { title: string; within_1y: number }; slowest: { title: string; within_1y: number } };
  difficulty: { all: Group; contested: Group };
  settlement: { horizon_days: number; criminal_calendar_by_law: { law: string; cases: number; settled: number }[] };
  cases: { national: number; tamil_nadu: number };
  model_info: { train_cases: number; test_cases: number; n_inputs: number; train_years: number[]; name?: string };
  test_year: number;
};

function CaseTape() {
  const { median_wait_first_hearing: wait, median_after_first_hearing: after, median_gap_between_hearings: gap } = RES.stages;
  const total = wait + after;
  const hearings = Math.round(after / gap);
  const marks = Array.from({ length: hearings }, (_, i) => wait + i * gap).filter((d) => d < total);
  return (
    <>
      <div className="tape tape-roll" role="img" aria-label={`A typical real dispute drawn to scale: first hearing after ${Math.round(wait)} days, then about ${hearings} hearing dates ${Math.round(gap)} days apart, ${duration(Math.round(total))} in all.`}>
        <div className="m-wrap h-full">
          <div className="tape-track">
            {marks.map((d, i) => (
              <span key={d} className="tape-mark" data-first={i === 0 ? "" : undefined} style={{ left: `${(d / total) * 100}%`, "--i": i } as CSSProperties} />
            ))}
            <span className="tape-end" />
          </div>
        </div>
      </div>
      <div className="m-wrap tape-notes">
        <p>
          <b>First hearing</b>
          after {Math.round(wait)} days
        </p>
        <p>
          <b>About {hearings} hearing dates</b>
          {Math.round(gap)} days apart
        </p>
        <p>
          <b>Half are over</b>
          {duration(Math.round(after))} after the first hearing
        </p>
      </div>
    </>
  );
}

const WORK = [{ src: "/pipeline/figures/A5-3.png", w: 776, h: 392, text: "Step A5: finding when each court's records stop, so unfinished cases aren't counted as fast." }, { src: "/pipeline/figures/A6-4.png", w: 920, h: 376, text: "Step A6: the early years are missing cases, so the model only uses 2015 onwards." }, { src: "/pipeline/figures/B6-17.png", w: 526, h: 516, text: "Step B6: when the model says 70%, about 70% really finish." }];

const DATA_STEPS = ["Collect the records", "Clean the mess", "Label each case", "Explore the data"];
const ML_STEPS = ["Choose the inputs", "Split by year", "Train and compare", "Test on unseen cases", "Deploy"];

export function Home() {
  const options = useQuery({ queryKey: ["model-options"], queryFn: getOptions, staleTime: Infinity, retry: 3 });
  const topics = options.data ? Object.fromEntries(options.data.topics.map((t) => [t.id, t])) : undefined;
  const { fastest, slowest } = RES.topic_extremes;
  const hard = RES.difficulty.contested;
  const { median_wait_first_hearing: wait, median_after_first_hearing: after } = RES.stages;
  const cheque = RES.settlement.criminal_calendar_by_law.find((l) => l.law === "Negotiable Instruments Act");
  const ipc = RES.settlement.criminal_calendar_by_law.find((l) => l.law === "Indian Penal Code");
  return (
    <>
      <section className="ch-cover">
        <div className="m-wrap ch-cover-top">
          <h1>Which court cases get stuck?</h1>
          <p className="ch-cover-lead">We cleaned {(RES.cases.tamil_nadu / 1e6).toFixed(1)} million Tamil Nadu court records, then trained a model on only what is known the day a case is filed. Test it, and see exactly how far it can be trusted.</p>
          <div className="m-actions">
            <Link href="/model/explore" className="m-btn">
              Test the model
            </Link>
            <Link href="/model/pipeline" className="m-btn-2">
              See the pipeline
            </Link>
            <Link href="/model/analytics" className="m-btn-2">
              Data analysis
            </Link>
          </div>
        </div>
        <CaseTape />
      </section>

      <section className="ch ch-ink" aria-labelledby="found">
        <div className="m-wrap">
          <h2 id="found">What we found</h2>
          <div className="finding">
            <p className="finding-figure">
              {pct(fastest.within_1y)} vs {pct(slowest.within_1y)}
            </p>
            <div>
              <h3>The kind of case decides most</h3>
              <p>
                {fastest.title} cases are over within a year {pct(fastest.within_1y)} of the time. {slowest.title} cases: {pct(slowest.within_1y)}.
              </p>
            </div>
          </div>
          <div className="finding">
            <p className="finding-figure">
              {pct(hard.accuracy, 1)} vs {pct(hard.majority_accuracy, 1)}
            </p>
            <div>
              <h3>Real disputes are hard to call on day one</h3>
              <p>The model is {pct(RES.difficulty.all.accuracy, 1)} accurate overall, mostly on petty cases. On real disputes it barely beats always guessing &ldquo;not within a year&rdquo;.</p>
            </div>
          </div>
          <div className="finding">
            <p className="finding-figure">{Math.round((after / (after + wait)) * 100)}%</p>
            <div>
              <h3>The time comes after the start</h3>
              <p>
                That share of a real dispute&apos;s time comes after its first hearing. It waits a median of {Math.round(wait)} days to begin, then runs {duration(Math.round(after))} more.
              </p>
            </div>
          </div>
          {cheque && ipc && (
            <div className="finding">
              <p className="finding-figure">
                {pct(cheque.settled, 1)} vs {pct(ipc.settled, 1)}
              </p>
              <div>
                <h3>Cheque-bounce cases settle far more often</h3>
                <p>Share of magistrate trials settled within two years: cheque-bounce cases against Indian Penal Code cases. This is where a legal-aid office could steer cases to mediation.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="ch ch-red">
        <div className="m-wrap">
          <RealCase variant="chapter" topics={topics} testN={RES.difficulty.all.n} testAccuracy={RES.difficulty.all.accuracy} />
        </div>
      </section>

      <section className="ch" aria-labelledby="built">
        <div className="m-wrap split split-start">
          <div>
            <h2 id="built">What we built it from</h2>
            <Image src="/model/madras-high-court.jpg" width={1920} height={1122} alt="The red-domed buildings of the Madras High Court in Chennai" sizes="(max-width: 860px) 100vw, 560px" className="photo mt-7" />
            <p className="photo-caption">Madras High Court, Chennai. Tamil Nadu&apos;s district courts work under it.</p>
          </div>
          <div className="facts">
            <div>
              <h3>Who this helps</h3>
              <p>It is a planning tool, not a prediction for one person&apos;s case. A court registry can estimate how many new cases will still be open a year later, and legal-aid offices can see which kinds of case to steer towards mediation.</p>
            </div>
            <div>
              <h3>The data</h3>
              <p>
                {(RES.cases.national / 1e6).toFixed(1)} million Indian district-court records filed 2010–2018, from the government&apos;s eCourts system, with names removed. One row per case.
              </p>
            </div>
            <div>
              <h3>The model</h3>
              <p>
                Logistic regression that predicts whether a case will be over within a year. Trained on {RES.model_info.train_cases.toLocaleString("en-IN")} cases filed in {RES.model_info.train_years.join(" and ")}, using {RES.model_info.n_inputs} inputs known on filing day, and tested on {RES.model_info.test_cases.toLocaleString("en-IN")} cases filed in {RES.test_year}.
              </p>
            </div>
            <div className="split split-start !gap-6">
              <div>
                <h3>Data analysis</h3>
                <ol className="steps">
                  {DATA_STEPS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>Machine learning</h3>
                <ol className="steps">
                  {ML_STEPS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
            <Link href="/model/pipeline" className="m-link">
              See every step, with the code and results
            </Link>
          </div>
        </div>
        <div className="m-wrap work">
          {WORK.map((f) => (
            <figure key={f.src}>
              <Image src={f.src} width={f.w} height={f.h} alt={f.text} unoptimized />
              <figcaption>{f.text}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
