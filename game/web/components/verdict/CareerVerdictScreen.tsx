"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cutscene } from "@/components/career/Cutscene";
import { BriefingModal } from "@/components/case/BriefingModal";
import { Portrait } from "@/components/case/Portrait";
import { LampLight } from "@/components/fx/LampLight";
import { Typewriter } from "@/components/fx/Typewriter";
import { BackButton } from "@/components/ui/BackButton";
import { getCareer, getCaseState, openCareerCase, reportUrl } from "@/lib/api";
import { BAND_LABEL, BAND_STYLE, markAppraisalSeen } from "@/lib/career";
import { loadCaseMemory, restoreSnapshot } from "@/lib/caseMemory";
import { cn } from "@/lib/cn";
import type { Figure } from "@/lib/plotlyData";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import { TOOL_META } from "@/lib/toolMeta";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedEffects } from "@/lib/useReducedEffects";
import type { CaseMeta } from "@/lib/types";
import { RevealReplay } from "./RevealReplay";
import { VerdictStamp } from "./VerdictStamp";

const TOOL_NAMES: Record<string, string> = {
  summary: "Case Summary", groupby: "Pattern Matrix", zscore: "Z-Score Scan", iqr_box: "Box & Whisker",
  duplicates: "Twin Finder", benford: "Benford's Law", timeseries: "Timeline", regression: "Margin Model",
  isoforest: "Anomaly Hunter",
};

type Phase = "stamp" | "rating" | "reveal";

/** Career Mode's verdict: the stamp, the 0–100 rating with a reason for every part, where the
 *  contract stands — then how they did it. */
export function CareerVerdictScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const reduced = useReducedEffects();
  const phone = useMediaQuery("(max-width: 639px)") ?? false;
  const meta = useCaseStore((s) => s.meta);
  const verdict = useCaseStore((s) => s.careerVerdict);
  const valid = meta?.case_id === caseId && verdict !== null;
  const [phase, setPhase] = useState<Phase>("stamp");
  const [briefing, setBriefing] = useState<CaseMeta | null>(null);
  const [ending, setEnding] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const leaving = useRef(false); // opening the next case clears the store: don't restore this one over it
  const code = meta?.career?.code ?? "";

  // A reload loses the in-memory verdict: ask the server. Still open? Back to the files.
  const restored = useQuery({ queryKey: ["case-state", caseId], queryFn: () => getCaseState(caseId), enabled: !valid });
  useEffect(() => {
    if (valid || leaving.current || (!restored.isFetchedAfterMount && !restored.isError) || (!restored.data && !restored.isError)) return;
    if (restored.data?.career_verdict) {
      useCaseStore.getState().hydrate(restoreSnapshot(restored.data, loadCaseMemory(caseId)));
    } else {
      router.replace(restored.data ? `/case/${caseId}` : "/career");
    }
  }, [valid, restored.data, restored.isError, restored.isFetchedAfterMount, caseId, router]);

  const career = useQuery({ queryKey: ["career", code], queryFn: () => getCareer(code), enabled: Boolean(code && verdict?.appraisal) });
  const next = useMutation({
    mutationFn: () => openCareerCase(code),
    onSuccess: (m) => {
      sfx.play("whoosh");
      setBriefing(m);
    },
  });

  useEffect(() => {
    sfx.stop("heartbeat");
    sfx.loop("rain");
  }, []);

  const onLand = useCallback(() => {
    if (!verdict) return;
    setPhase((p) => (p === "stamp" ? "rating" : p));
    sfx.play(verdict.correct ? "correct" : "wrong");
    if (verdict.correct && !reduced) {
      const colors = ["#f5a524", "#e5484d", "#efe6d2"];
      void confetti({ particleCount: 90, spread: 75, angle: 60, origin: { x: 0, y: 0.65 }, colors, zIndex: 150 });
      void confetti({ particleCount: 90, spread: 75, angle: 120, origin: { x: 1, y: 0.65 }, colors, zIndex: 150 });
    }
    window.setTimeout(() => {
      setPhase("reveal");
      window.setTimeout(() => revealRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }), 120);
    }, reduced ? 0 : 1600);
  }, [verdict, reduced]);

  if (!valid || !meta || !verdict || !meta.career) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <p className="animate-blink font-type tracking-[0.4em] text-amber">PULLING THE VERDICT…</p>
      </div>
    );
  }

  const info = meta.career;
  const accused = verdict.accused.map((id) => meta.suspects.find((s) => s.id === id)!).filter(Boolean);
  const rating = verdict.rating;
  const progress = verdict.progress;
  const finished = verdict.appraisal !== null;
  const caughtAll = verdict.correct;

  return (
    <div className="tex-desk relative min-h-dvh overflow-x-hidden pb-20">
      <LampLight size={900} />
      <header className="relative z-30 flex items-center justify-between gap-3 border-b border-black/60 bg-[#0b0d12]/85 px-4 py-2 backdrop-blur">
        <div className="flex shrink-0 items-center gap-3">
          <BackButton href="/career" label="Career" />
          <Link href="/career" className="hidden whitespace-nowrap arcade-logo font-pixel text-xs sm:inline">OUTLIER</Link>
        </div>
        <p className="truncate font-type text-[10px] tracking-[0.35em] text-amber/80 sm:text-xs">
          {info.company.toUpperCase()} · CASE {info.index} OF {info.total}
        </p>
      </header>

      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pt-8 sm:pt-12">
        <p className="font-type text-xs tracking-[0.5em] text-muted">THE VERDICT</p>

        <motion.section
          initial={reduced ? false : { opacity: 0, y: 30, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: -1.2 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="tex-paper relative w-full max-w-2xl rounded-[2px] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.65)] sm:p-8"
        >
          <p className="font-type text-[10px] tracking-[0.35em] opacity-60">ACCUSED</p>
          <div className={cn("mt-2 grid gap-5", accused.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            {accused.map((s) => (
              <div key={s.id} className="flex items-center gap-4">
                <div className="shrink-0" style={{ width: phone ? 72 : 120 }}><Portrait suspect={s} size={phone ? 72 : 120} /></div>
                <div className="min-w-0">
                  <h1 className="font-display text-2xl italic leading-tight sm:text-4xl">{s.name}</h1>
                  <p className="font-type text-sm opacity-75">{s.role}</p>
                </div>
              </div>
            ))}
          </div>
          <VerdictStamp correct={caughtAll} onLand={onLand} />
        </motion.section>

        <AnimatePresence>
          {phase !== "stamp" && (
            <motion.section
              aria-label="Your rating"
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl rounded-sm border border-line bg-ink-900/90 p-5 sm:p-7"
              data-testid="case-rating"
            >
              {rating.culprits > 1 && (
                <p className="mb-3 text-center font-type text-sm text-paper/85">
                  You caught {rating.caught} of the 2 fraudsters.
                </p>
              )}
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-type text-xs tracking-[0.35em] text-paper/60">CASE RATING</p>
                <p className="font-display text-5xl italic text-paper" data-testid="rating-total">
                  {Math.round(rating.total)}<span className="text-2xl text-paper/50">/100</span>
                </p>
              </div>
              <ul className="mt-4 space-y-3">
                {rating.parts.map((part) => {
                  return (
                    <li key={part.name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-paper">{part.name}</span>
                        <span className="tabular-nums text-paper/80">{part.points} / {part.out_of}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${part.out_of ? (100 * part.points) / part.out_of : 0}%` }}
                          transition={{ duration: reduced ? 0 : 0.8, delay: 0.15 }}
                          className={cn("h-full rounded-full", part.points >= part.out_of * 0.8 ? "bg-green" : part.points > 0 ? "bg-amber" : "bg-red")}
                        />
                      </div>
                      <p className="mt-1 text-[13px] text-paper/60">{part.reason}</p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4" data-testid="contract-progress">
                <p className="text-paper/80">
                  {progress.company} · Case {progress.index} of {progress.total} · average{" "}
                  <span className="font-bold text-paper">{progress.average}</span>
                </p>
                <span className={cn("rounded-sm border px-2 py-0.5 text-xs", BAND_STYLE[progress.band_so_far])}>
                  {finished ? "" : "on track for: "}{BAND_LABEL[progress.band_so_far]}
                </span>
                <div className="flex w-full gap-1.5">
                  {progress.ratings.map((r, i) => (
                    <span key={i} className={cn("flex-1 rounded-sm py-1 text-center text-xs tabular-nums",
                      r === null ? "bg-ink-800 text-paper/30" : i === progress.index - 1 ? "bg-amber/25 text-amber" : "bg-white/10 text-paper/70")}>
                      {r === null ? "·" : Math.round(r)}
                    </span>
                  ))}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {phase === "reveal" && (
          <section ref={revealRef} aria-label="How they did it" data-testid="reveal" className="w-full scroll-mt-16">
            {verdict.culprits.map((c, i) => (
              <motion.div
                key={c.fraudster.id}
                initial={reduced ? false : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.3 }}
                className="mb-10 border-t border-line/70 pt-8"
              >
                <div className="mb-5 flex items-center gap-4">
                  <div className="shrink-0" style={{ width: phone ? 76 : 110 }}>
                    <Portrait suspect={c.fraudster} size={phone ? 76 : 110} highlight caption={false} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("font-type text-[10px] tracking-[0.4em]", c.caught ? "text-green" : "text-red")}>
                      {c.caught ? "CAUGHT · HOW THEY DID IT" : "GOT AWAY · THE REAL CULPRIT"}
                    </p>
                    <h2 className="font-display text-3xl italic text-paper sm:text-4xl">{c.fraudster.name}</h2>
                    <p className="font-type text-sm text-muted">{c.fraudster.role}</p>
                  </div>
                </div>
                <p className="mb-5 min-h-[4.5rem] font-type text-base leading-relaxed text-paper/90 sm:text-lg">
                  <Typewriter text={c.explanation} speed={18} />
                </p>
                <RevealReplay figure={c.reveal_figure as Figure} play />
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="font-type text-[10px] tracking-[0.35em] text-muted">WHAT CATCHES IT</span>
                  {c.catching_tools.map((t) => (
                    <span key={t} className="rounded-sm border border-green/50 bg-green/10 px-2.5 py-1 font-mono text-[11px] text-green">
                      <span className="mr-1 font-display font-bold italic">{TOOL_META[t]?.icon}</span>
                      {TOOL_NAMES[t] ?? t} <span className="text-green/60">· {TOOL_META[t]?.lib}</span>
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}

            <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              {verdict.cutscene ? (
                <button
                  onClick={() => {
                    sfx.play("stamp");
                    setEnding(true);
                  }}
                  data-testid="what-happened"
                  className="rounded-sm border-2 border-[#ffd319] bg-[#ffd319]/15 px-6 py-3 font-type tracking-[0.18em] text-[#ffd319] shadow-[0_0_30px_rgba(255,211,25,0.25)] hover:bg-[#ffd319]/25"
                >
                  ▶ WHAT HAPPENED
                </button>
              ) : finished ? (
                <Link
                  href="/career"
                  onClick={() => sfx.play("pin")}
                  data-testid="see-appraisal"
                  className="rounded-sm border-2 border-amber bg-amber/15 px-6 py-3 text-center font-type tracking-[0.18em] text-amber shadow-[0_0_30px_rgba(245,165,36,0.25)] hover:bg-amber/25"
                >
                  YOUR APPRAISAL →
                </Link>
              ) : (
                <button
                  onClick={() => next.mutate()}
                  disabled={next.isPending}
                  data-testid="next-case"
                  className="rounded-sm border-2 border-amber bg-amber/15 px-6 py-3 font-type tracking-[0.18em] text-amber shadow-[0_0_30px_rgba(245,165,36,0.25)] hover:bg-amber/25 disabled:opacity-60"
                >
                  {next.isPending ? "PULLING THE FILE…" : `NEXT CASE · ${info.index + 1} OF ${info.total} →`}
                </button>
              )}
              <Link href="/career" onClick={() => sfx.play("tick")}
                className="rounded-sm border border-line px-6 py-3 text-center font-type tracking-[0.18em] text-paper/70 hover:border-paper/50 hover:text-paper">
                BACK TO YOUR CAREER
              </Link>
              <a href={reportUrl(meta.case_id)} download onClick={() => sfx.play("rustle")}
                className="rounded-sm border border-line px-6 py-3 text-center font-type tracking-[0.18em] text-paper/70 hover:border-paper/50 hover:text-paper">
                CASE REPORT · PDF
              </a>
            </div>
            {next.isError && <p role="alert" className="mt-3 text-center text-red">{next.error.message}</p>}
          </section>
        )}
      </main>

      <BriefingModal
        meta={briefing}
        closeLabel="BACK TO YOUR CAREER"
        onClose={() => router.push("/career")}
        onOpenFiles={(m) => {
          leaving.current = true;
          setBriefing(null);
          useCaseStore.getState().reset();
          router.push(`/case/${m.case_id}`);
        }}
      />
      {ending && (
        <Cutscene
          scene={verdict.cutscene}
          salary={career.data?.salary}
          title={career.data?.title}
          onDone={() => {
            if (career.data) markAppraisalSeen(code, career.data.history.length - 1);
            router.push("/career");
          }}
        />
      )}
    </div>
  );
}
