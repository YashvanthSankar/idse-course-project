"use client";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics, pct } from "@/lib/model";
import { REPO } from "./Shell";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--m-line)] bg-[var(--m-card)] p-5">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-[var(--m-ink-2)] [&_b]:text-[var(--m-ink)]">{children}</div>
    </section>
  );
}

/** The model card. Numbers come from the pipeline's exported analytics. */
export function About() {
  const q = useQuery({ queryKey: ["model-analytics"], queryFn: getAnalytics, staleTime: Infinity });
  const a = q.data;
  const c = a?.tamil_nadu.cleaning;
  const served = a ? a.model.test[a.model.served] : null;
  const lookup = a ? a.model.test["baseline: rate per case type x district"] : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">About the model</h1>
      <Section title="The question">
        <p>
          <b>Will a Tamil Nadu district-court case be disposed of within a year of being filed?</b> &ldquo;Disposed of&rdquo; means the
          case ended in that court (a judgment, a dismissal, a settlement or Lok Adalat disposal, or a file closed while the accused is
          absconding). A transfer to another court is not an ending.
        </p>
      </Section>
      <Section title="The data">
        <p>
          Development Data Lab&apos;s judicial data: {a ? `${(a.national.cases / 1e6).toFixed(1)} million` : "about 81 million"} cases filed in
          India&apos;s district and subordinate courts in 2010–2018, collected from the government&apos;s eCourts portal and stripped of
          personal details. Licence: <b>ODbL v1.0</b> (the licence file in the download; the website says CC BY-NC-SA). We model Tamil
          Nadu ({a ? `${(a.tamil_nadu.cases / 1e6).toFixed(2)} million` : "3.64 million"} cases) and use all of India for the scrape-date
          and backlog charts.
        </p>
      </Section>
      <Section title="Cleaning (what was wrong, and what we did)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {c ? c.raw_law_names.toLocaleString("en-IN") : "29,857"} spellings of law names (&ldquo;NegotiableInstrumentsAct&rdquo;,
            &ldquo;N. I. Act&rdquo;, &ldquo;U/S 138 of N.I Act&rdquo;…) mapped by tested rules to {c?.canonical_laws ?? 54} laws, covering{" "}
            {c ? pct(c.law_rows_named, 1) : "94%"} of rows; the rest stay &ldquo;Other&rdquo; rather than guessed.
          </li>
          <li>
            {c?.raw_court_names ?? 116} court names, with typos and place names, reduced to court levels; section strings such as
            &ldquo;138r/w142&rdquo; and &ldquo;OVIIR1&rdquo; reduced to the main section (138, Order 7).
          </li>
          <li>
            Impossible dates (year 0001, 5000-01-01) blanked and counted; {c ? c.decided_before_filing.toLocaleString("en-IN") : "23,497"} Tamil
            Nadu cases decided &ldquo;before filing&rdquo; set aside.
          </li>
          <li>No scrape date exists in the data, so it was estimated from where monthly decisions collapse, district by district.</li>
        </ul>
      </Section>
      <Section title="Labels without guessing">
        <p>
          A case only gets a &ldquo;within a year?&rdquo; label if its court was watched for at least a year after filing; a case that moved
          to another court before a year is left unlabelled. Without this rule, recent cases that ended fast would be labelled while their
          slow neighbours could not be, and the model would learn that courts are faster than they are.
        </p>
      </Section>
      <Section title="Training and testing">
        <p>
          Inputs known on the day of filing: district, court level, case type, month, the law and main section, whether the IPC offence is
          bailable, how many sections are charged, and how congested those courts were (cases waiting, and how many they cleared the year
          before). Not used: gender, hearing dates or purposes (they describe the case&apos;s future).
        </p>
        <p>
          Logistic regression, a linear SVM and a random forest were compared with simple baselines. The model was chosen on 2016 filings,
          refitted on 2015–2016, and tested once on 2017.{" "}
          {served && lookup && (
            <>
              On those 2017 cases it reaches <b>AUC {served.auc.toFixed(3)}</b> and <b>Brier {served.brier.toFixed(3)}</b>, against{" "}
              {lookup.auc.toFixed(3)} and {lookup.brier.toFixed(3)} for a lookup table of the rate per case type and district.
            </>
          )}
        </p>
      </Section>
      <Section title="Limitations">
        <ul className="list-disc space-y-1 pl-5">
          <li>It describes Tamil Nadu cases filed 2015–2017. Courts were getting faster each year, so it slightly underestimates later years.</li>
          <li>Most of what it knows is which kinds of case are quick. Between two cases of the same kind it can barely tell which ends first.</li>
          <li>Court workload is taken as it stood at the end of the data (early 2019), not today.</li>
          <li>It is a statistical summary of past cases, not a prediction for any real case, and not legal advice.</li>
        </ul>
      </Section>
      <p className="text-sm text-[var(--m-ink-3)]">
        Full method, code, tests and notebooks:{" "}
        <a className="underline" href={REPO} target="_blank" rel="noreferrer">
          pipeline/ on GitHub
        </a>
        .
      </p>
    </div>
  );
}
