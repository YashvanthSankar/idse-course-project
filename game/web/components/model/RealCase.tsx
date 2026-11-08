"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { duration, getSample, MONTHS, pct, type Sample } from "@/lib/model";

/** Draw a real 2017 case the model never saw and compare its prediction with what happened. */
export function RealCase({ topics, testN, testAccuracy, variant = "panel" }: { topics?: Record<string, { title: string }>; testN: number; testAccuracy: number; variant?: "panel" | "chapter" }) {
  const [tally, setTally] = useState({ checked: 0, right: 0 });
  const [last, setLast] = useState<Sample | null>(null);
  const draw = useMutation({
    mutationFn: getSample,
    retry: 3,
    retryDelay: 700,
    onSuccess: (s) => {
      setLast(s);
      setTally((t) => ({ checked: t.checked + 1, right: t.right + Number(s.probability >= 0.5 === s.actual.within_1y) }));
    },
  });
  const title = last ? (topics?.[last.case.topic]?.title ?? last.case.title) : "";
  const right = last ? last.probability >= 0.5 === last.actual.within_1y : false;
  const [y, m] = last ? last.case.filed.split("-").map(Number) : [0, 0];

  const button = (
    <button type="button" onClick={() => draw.mutate()} disabled={draw.isPending} className="m-btn" data-testid={variant === "chapter" ? "home-sample" : "model-sample"}>
      {draw.isPending ? "Loading…" : last ? "Another real case" : "Show a real case"}
    </button>
  );
  const slip = last ? (
    <div className="slip" data-testid={variant === "chapter" ? "home-sample-result" : "model-sample-result"} aria-live="polite">
      <div className="slip-row">
        <p className="slip-label">The case</p>
        <p className="slip-value">{title}</p>
        <p className="slip-sub">
          {last.case.district}, filed {MONTHS[m - 1]} {y}
        </p>
      </div>
      <div className="slip-row">
        <p className="slip-label">The model predicted</p>
        <p className="slip-value">{last.probability >= 0.5 ? "Likely within 1 year" : "Not likely within 1 year"}</p>
        <p className="slip-sub">{pct(last.probability)} probability</p>
      </div>
      <div className="slip-row">
        <p className="slip-label">What really happened</p>
        <p className="slip-value">
          {last.actual.ended ? (last.actual.observed_days === 0 ? "Over the day it was filed" : `Over after ${duration(last.actual.observed_days)}`) : `Still open after ${duration(last.actual.observed_days)}`}
        </p>
        <p className="slip-sub font-semibold" style={{ color: right ? "var(--m-good)" : "var(--m-critical)" }}>
          {right ? "The model was right" : "The model was wrong"}
        </p>
      </div>
      <p className="slip-row slip-sub">
        Right {tally.right} of {tally.checked} on this visit. Across all {testN.toLocaleString("en-IN")} test cases: {pct(testAccuracy, 1)}.
      </p>
    </div>
  ) : null;
  const error = draw.isError ? <p className="mt-3">Couldn&apos;t load a case. Please try again.</p> : null;

  if (variant === "chapter")
    return (
      <div className="split">
        <div>
          <h2>Check it against a real case</h2>
          <p className="lead">Draw a random case filed in 2017. The model never saw these. Its prediction is shown next to what really happened.</p>
          {button}
          {error}
        </div>
        {slip ?? (
          <div className="slip">
            <p className="slip-value">Press the button to pull a file.</p>
            <p className="slip-sub mt-1">
              There are {testN.toLocaleString("en-IN")} test cases. The model got {pct(testAccuracy, 1)} of them right, mostly the easy ones.
            </p>
          </div>
        )}
      </div>
    );
  return (
    <section className="m-panel" aria-label="Check against real outcomes">
      <h2 className="m-h2">Or check it against a real case</h2>
      <p className="m-note mb-3">Draw a random case filed in 2017 that the model never saw, and compare its prediction with what happened.</p>
      {button}
      {error && <div className="text-[var(--m-critical)]">{error}</div>}
      {slip ?? (
        <div className="slip">
          <p className="slip-row slip-sub">
            There are {testN.toLocaleString("en-IN")} test cases. The model got {pct(testAccuracy, 1)} of them right, mostly the easy ones.
          </p>
        </div>
      )}
    </section>
  );
}
