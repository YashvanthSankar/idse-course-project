"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";

const LINES = [
  ["base", "Caught the right suspect"],
  ["evidence", "Evidence on the board"],
  ["budget_bonus", "Coins left over · +40 each"],
] as const;

const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));

/** Counts from 0 to `to` once `run` turns true, ticking as it goes. */
function useCountUp(to: number, run: boolean, duration: number, instant: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run || instant) return;
    let raf = 0;
    let start: number | null = null;
    let lastTick = 0;
    const step = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / duration);
      setValue(to * (1 - Math.pow(1 - p, 3)));
      if (now - lastTick > 70 && p < 1) {
        lastTick = now;
        sfx.play("tick");
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, run, duration, instant]);
  return instant && run ? to : value;
}

function Line({ label, value, run, instant }: { label: string; value: number; run: boolean; instant: boolean }) {
  const shown = useCountUp(value, run, 450, instant);
  return (
    <motion.li
      initial={instant ? false : { opacity: 0, x: -14 }}
      animate={run ? { opacity: 1, x: 0 } : { opacity: 0 }}
      className="flex items-baseline justify-between gap-4 border-b border-dashed border-line/70 py-2 font-mono text-sm"
    >
      <span className="text-muted">{label}</span>
      <span className={cn(value < 0 ? "text-red" : value > 0 ? "text-paper" : "text-muted")}>
        {value < 0 ? "−" : "+"}
        {fmt(Math.abs(shown))}
      </span>
    </motion.li>
  );
}

export function ScoreCounter({ breakdown, score, correct, onDone }: {
  breakdown: Record<string, number>;
  score: number;
  correct: boolean;
  onDone?: () => void;
}) {
  const instant = useReducedEffects();
  const [step, setStep] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (instant) {
      done.current?.();
      return;
    }
    const timers = LINES.map((_, i) => window.setTimeout(() => setStep(i + 1), 400 * (i + 1)));
    timers.push(window.setTimeout(() => setStep(LINES.length + 1), 400 * (LINES.length + 1)));
    timers.push(window.setTimeout(() => done.current?.(), 400 * (LINES.length + 1) + 1100));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [instant]);

  const shownStep = instant ? LINES.length + 1 : step;
  const total = useCountUp(score, shownStep > LINES.length, 900, instant);
  const finished = shownStep > LINES.length && Math.round(total) === score;

  return (
    <section aria-label="Score" className="w-full rounded-lg border border-line bg-ink-900/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:p-6">
      <p className="font-type text-[10px] tracking-[0.4em] text-muted">THE TALLY</p>
      <ul className="mt-2">
        {LINES.map(([key, label], i) => (
          <Line key={key} label={label} value={breakdown[key] ?? 0} run={shownStep > i} instant={instant} />
        ))}
      </ul>
      <div className="mt-4 flex items-end justify-between gap-4">
        <span className="font-type text-xs tracking-[0.3em] text-muted">{correct ? "CASE SCORE" : "NO CONVICTION"}</span>
        <span
          data-testid="final-score"
          data-done={finished}
          className={cn(
            "font-display text-6xl font-black italic leading-none sm:text-7xl",
            correct ? "text-amber [text-shadow:0_0_30px_rgba(245,165,36,0.45)]" : "text-muted",
          )}
        >
          {fmt(shownStep > LINES.length ? total : 0)}
        </span>
      </div>
    </section>
  );
}
