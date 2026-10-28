"use client";
import { BackButton } from "@/components/ui/BackButton";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Portrait } from "@/components/case/Portrait";
import { LampLight } from "@/components/fx/LampLight";
import { Typewriter } from "@/components/fx/Typewriter";
import { useAccused } from "@/lib/accused";
import { useQuery } from "@tanstack/react-query";
import { getCaseState, reportUrl } from "@/lib/api";
import { loadCaseMemory, restoreSnapshot } from "@/lib/caseMemory";
import { roomForCase } from "@/lib/roomCase";
import { cn } from "@/lib/cn";
import type { Figure } from "@/lib/plotlyData";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import { TOOL_META, toolMeta } from "@/lib/toolMeta";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedEffects } from "@/lib/useReducedEffects";
import { RevealReplay } from "./RevealReplay";
import { ScoreCounter } from "./ScoreCounter";
import { VerdictStamp } from "./VerdictStamp";

const GRADE_STYLE: Record<string, string> = {
  strong: "border-green/60 bg-green/10 text-green",
  supportive: "border-amber/60 bg-amber/10 text-amber",
  weak: "border-line bg-ink-800 text-muted",
  irrelevant: "border-red/60 bg-red/10 text-red",
};

const TOOL_NAMES: Record<string, string> = {
  summary: "Case Summary", groupby: "Pattern Matrix", zscore: "Z-Score Scan", iqr_box: "Box & Whisker",
  duplicates: "Twin Finder", benford: "Benford's Law", timeseries: "Timeline", regression: "Margin Model",
  isoforest: "Anomaly Hunter",
};

type Phase = "stamp" | "score" | "reveal";

export function VerdictScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const reduced = useReducedEffects();
  const phone = useMediaQuery("(max-width: 639px)") ?? false;
  const meta = useCaseStore((s) => s.meta);
  // Server render has no sessionStorage: read it only on the client, without a mismatch.
  const classRoom = useSyncExternalStore(noSubscribe, () => roomForCase(caseId), () => null);
  const verdict = useCaseStore((s) => s.verdict);
  const results = useCaseStore((s) => s.results);
  const accusedInMemory = useAccused((s) => s.byCase[caseId]);
  const accusedStored = useSyncExternalStore(noSubscribe, () => loadCaseMemory(caseId)?.accused ?? null, () => null);
  const accusedId = accusedInMemory ?? accusedStored;
  const valid = meta?.case_id === caseId && verdict !== null;
  const [phase, setPhase] = useState<Phase>("stamp");
  const revealRef = useRef<HTMLDivElement>(null);

  // A reload loses the in-memory verdict: ask the server. Still open? Back to the files.
  const restored = useQuery({
    queryKey: ["case-state", caseId],
    queryFn: () => getCaseState(caseId),
    enabled: !valid,
  });
  useEffect(() => {
    if (valid || !restored.data && !restored.isError) return;
    if (restored.data?.verdict) {
      useCaseStore.getState().hydrate(restoreSnapshot(restored.data, loadCaseMemory(caseId)));
    } else {
      router.replace(`/case/${caseId}`);
    }
  }, [valid, restored.data, restored.isError, caseId, router]);

  useEffect(() => {
    sfx.stop("heartbeat");
    sfx.loop("rain");
  }, []);

  const onLand = useCallback(() => {
    if (!verdict) return;
    setPhase((p) => (p === "stamp" ? "score" : p));
    sfx.play(verdict.correct ? "correct" : "wrong");
    if (verdict.correct && !reduced) {
      const colors = ["#f5a524", "#e5484d", "#efe6d2"];
      void confetti({ particleCount: 90, spread: 75, angle: 60, origin: { x: 0, y: 0.65 }, colors, zIndex: 150 });
      void confetti({ particleCount: 90, spread: 75, angle: 120, origin: { x: 1, y: 0.65 }, colors, zIndex: 150 });
      window.setTimeout(() => void confetti({ particleCount: 140, spread: 110, origin: { y: 0.35 }, colors, zIndex: 150, scalar: 1.1 }), 350);
    }
  }, [verdict, reduced]);

  const onScored = useCallback(() => {
    setPhase("reveal");
    window.setTimeout(() => revealRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }), 120);
  }, [reduced]);

  if (!valid || !meta || !verdict) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <p className="animate-blink font-type tracking-[0.4em] text-amber">PULLING THE VERDICT…</p>
      </div>
    );
  }

  const accused = meta.suspects.find((s) => s.id === accusedId) ?? verdict.fraudster;
  const resultTitle = (id: string, tool: string) => results.find((r) => r.result_id === id)?.title ?? TOOL_NAMES[tool] ?? tool;
  const showScore = phase !== "stamp";
  const nextLevel = Math.min(7, meta.level + 1);

  return (
    <div className="tex-desk relative min-h-dvh overflow-x-hidden pb-20">
      <LampLight size={900} />
      <header className="relative z-30 flex items-center justify-between gap-3 border-b border-black/60 bg-[#0b0d12]/85 px-4 py-2 backdrop-blur">
        <div className="flex shrink-0 items-center gap-3">
          <BackButton href="/office" label="Case desk" short="Desk" />
          <Link href="/office" className="hidden whitespace-nowrap font-display text-lg font-black italic text-[#ffd9da] [text-shadow:0_0_10px_rgba(229,72,77,0.8)] sm:inline">
            The Auditor
          </Link>
        </div>
        <p className="truncate font-type text-[10px] tracking-[0.35em] text-amber/80 sm:text-xs">
          CASE No. {String(meta.level).padStart(2, "0")} · {meta.title.toUpperCase()}
        </p>
      </header>

      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-4 pt-8 sm:pt-12">
        <p className="font-type text-xs tracking-[0.5em] text-muted">THE VERDICT</p>

        {/* the case file the stamp lands on */}
        <motion.section
          initial={reduced ? false : { opacity: 0, y: 30, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: -1.2 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="tex-paper relative w-full max-w-2xl rounded-[2px] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.65)] sm:p-8"
        >
          <div className="flex items-center gap-5 sm:gap-8">
            {/* fixed-width box: Portrait's % padding resolves against its container */}
            <div className="shrink-0" style={{ width: phone ? 104 : 170 }}>
              <Portrait suspect={accused} size={phone ? 104 : 170} />
            </div>
            <div className="min-w-0 text-left">
              <p className="font-type text-[10px] tracking-[0.35em] opacity-60">ACCUSED</p>
              <h1 className="font-display text-3xl italic leading-tight sm:text-5xl">{accused.name}</h1>
              <p className="font-type text-sm opacity-75">{accused.role} · {accused.department}</p>
              <p className="mt-3 hidden max-w-sm text-sm italic opacity-70 sm:block">“{accused.bio}”</p>
            </div>
          </div>
          <VerdictStamp correct={verdict.correct} onLand={onLand} />
        </motion.section>

        <AnimatePresence>
          {showScore && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full max-w-2xl flex-col gap-4"
            >
              {!verdict.correct && (
                <p className="text-center font-type text-sm text-[#ffd9da]">
                  Wrong suspect. The real fraudster walks out the door — and {accused.name.split(" ")[0]} files a complaint.
                </p>
              )}
              <ScoreCounter breakdown={verdict.breakdown} score={verdict.score} correct={verdict.correct} onDone={onScored} />
              <div className="flex flex-wrap justify-center gap-2" aria-label="How your evidence was graded">
                {verdict.evidence.map((g) => (
                  <span key={g.result_id} data-testid="evidence-grade" data-grade={g.grade}
                    className={cn("rounded-sm border px-3 py-1.5 font-mono text-[11px]", GRADE_STYLE[g.grade])}>
                    <span className="mr-1 font-display font-bold italic">{toolMeta(g.tool_id).icon}</span>
                    {resultTitle(g.result_id, g.tool_id)} · {g.grade.toUpperCase()} {g.points > 0 ? `+${g.points}` : g.points}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "reveal" && (
          <motion.section
            ref={revealRef}
            aria-label="How they did it"
            data-testid="reveal"
            initial={reduced ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full scroll-mt-16"
          >
            <div className="mb-5 flex items-center gap-4 border-t border-line/70 pt-8">
              <div className="shrink-0" style={{ width: phone ? 76 : 110 }}>
                <Portrait suspect={verdict.fraudster} size={phone ? 76 : 110} highlight caption={false} />
              </div>
              <div className="min-w-0">
                <p className="font-type text-[10px] tracking-[0.4em] text-red">
                  {verdict.correct ? "HOW THEY DID IT" : "THE REAL CULPRIT"}
                </p>
                <h2 className="font-display text-3xl italic text-paper sm:text-4xl">{verdict.fraudster.name}</h2>
                <p className="font-type text-sm text-muted">{verdict.fraudster.role}</p>
              </div>
            </div>
            <p className="mb-5 min-h-[4.5rem] font-type text-base leading-relaxed text-paper/90 sm:text-lg">
              <Typewriter text={verdict.explanation} speed={18} />
            </p>
            <RevealReplay figure={verdict.reveal_figure as Figure} play={phase === "reveal"} />
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="font-type text-[10px] tracking-[0.35em] text-muted">WHAT CATCHES IT</span>
              {verdict.catching_tools.map((t) => (
                <span key={t} className="rounded-sm border border-green/50 bg-green/10 px-2.5 py-1 font-mono text-[11px] text-green">
                  <span className="mr-1 font-display font-bold italic">{TOOL_META[t]?.icon}</span>
                  {TOOL_NAMES[t] ?? t} <span className="text-green/60">· {TOOL_META[t]?.lib}</span>
                </span>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              {classRoom && (
                <Link
                  href={`/play/${classRoom}`}
                  onClick={() => sfx.play("pin")}
                  data-testid="back-to-class"
                  className="rounded-sm border-2 border-cyan bg-cyan/10 px-6 py-3 text-center font-type whitespace-nowrap tracking-[0.18em] text-cyan hover:bg-cyan/20"
                >
                  BACK TO CLASS · {classRoom} →
                </Link>
              )}
              <Link
                href="/office"
                onClick={() => sfx.play("pin")}
                data-testid="next-case"
                className="rounded-sm border-2 border-amber bg-amber/15 px-6 py-3 text-center font-type whitespace-nowrap tracking-[0.18em] text-amber shadow-[0_0_30px_rgba(245,165,36,0.25)] hover:bg-amber/25"
              >
                {verdict.correct && meta.level < 7 ? `NEXT CASE · No. ${String(nextLevel).padStart(2, "0")} →` : "TRY ANOTHER CASE →"}
              </Link>
              <Link
                href="/office"
                onClick={() => sfx.play("tick")}
                className="rounded-sm border border-line px-6 py-3 text-center font-type whitespace-nowrap tracking-[0.18em] text-paper/70 hover:border-paper/50 hover:text-paper"
              >
                BACK TO THE DESK
              </Link>
              <a
                href={reportUrl(meta.case_id)}
                download
                onClick={() => sfx.play("rustle")}
                className="rounded-sm border border-line px-6 py-3 text-center font-type whitespace-nowrap tracking-[0.18em] text-paper/70 hover:border-paper/50 hover:text-paper"
              >
                CASE REPORT · PDF
              </a>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
}

const noSubscribe = () => () => {};
