"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Portrait } from "@/components/case/Portrait";
import { Rain } from "@/components/fx/Rain";
import { Typewriter } from "@/components/fx/Typewriter";
import { formatSalary } from "@/lib/career";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";
import type { Cutscene as Scene } from "@/lib/types";

/** The end of the story (CAREER.md §7.5): an old colleague, replayed company by company from
 *  this career's real history — then the confession, or the escape. */
export function Cutscene({ scene, salary, title, onDone }: {
  scene: Scene | null;
  salary?: number;
  title?: string | null;
  onDone: () => void;
}) {
  const reduced = useReducedEffects();
  const [step, setStep] = useState(0);
  const caught = scene?.kind === "caught";
  // 0: the reveal · 1..n: one card per company you shared · n+1: what they say · n+2: the end
  const stops = scene?.stops ?? [];
  const total = stops.length + 3;

  useEffect(() => {
    if (!scene) return;
    sfx.stop("jazz");
    sfx.loop("rain");
    sfx.play(caught ? "stamp" : "wrong");
  }, [scene, caught]);

  const advance = () => {
    if (step >= total - 1) return onDone();
    sfx.play("rustle");
    setStep((s) => s + 1);
  };

  useEffect(() => {
    if (!scene) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!scene) return null;
  const person = { name: scene.name, role: "", portrait: scene.portrait };
  const stop = step >= 1 && step <= stops.length ? stops[step - 1] : null;

  return (
    <div role="dialog" aria-modal aria-label={caught ? "The confession" : "The escape"} data-testid="cutscene"
      className="fixed inset-0 z-[160] flex flex-col overflow-y-auto bg-black text-paper">
      <Rain density={caught ? 90 : 200} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_0,transparent_160px,rgba(0,0,0,0.9)_420px)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="flex w-full flex-col items-center"
          >
            {step === 0 && (
              <>
                <p className="font-type text-xs tracking-[0.5em] text-red">{caught ? "CAUGHT" : "GONE"}</p>
                <div className="mt-5 w-[180px]"><Portrait suspect={person} size={180} highlight /></div>
                <h1 className="mt-5 font-display text-4xl italic sm:text-5xl">{scene.name}</h1>
                <p className="mt-4 max-w-md font-type text-lg leading-relaxed text-paper/85">
                  <Typewriter text={caught
                    ? `It was ${scene.name.split(" ")[0]}. The friendly face from your very first job.`
                    : `${scene.name.split(" ")[0]} picks up a bag and walks to the lift. Nobody stops them. Nobody ever did.`} speed={24} />
                </p>
              </>
            )}
            {stop && (
              <article className="tex-paper w-full rounded-[2px] p-6 text-left text-ink-950 shadow-[0_30px_70px_rgba(0,0,0,0.7)]" data-testid="cutscene-stop">
                <p className="font-type text-[11px] tracking-[0.35em] opacity-60">YEAR {stop.year} · {stop.company.toUpperCase()}</p>
                <p className="mt-1 font-type text-sm opacity-80">{scene.name} · {stop.role}</p>
                <p className="mt-4 font-display text-2xl italic leading-snug">“{stop.line}”</p>
                <p className="mt-4 font-type text-sm">
                  {stop.lineups > 0
                    ? `Stood in your lineup ${stop.lineups} time${stop.lineups === 1 ? "" : "s"}. You looked at someone else every time.`
                    : "Never once in your lineup. Always just down the corridor."}
                </p>
              </article>
            )}
            {step === stops.length + 1 && (
              <>
                <div className="w-[120px]"><Portrait suspect={person} size={120} highlight caption={false} /></div>
                <p className="mt-6 max-w-lg font-display text-2xl italic leading-snug sm:text-3xl">
                  “<Typewriter text={scene.speech} speed={26} cursor={false} />”
                </p>
              </>
            )}
            {step === stops.length + 2 && (
              <>
                <p className="font-type text-xs tracking-[0.5em] text-amber">{caught ? "THE GOOD ENDING" : "THE BITTER ENDING"}</p>
                <p className="mt-5 max-w-lg font-type text-xl leading-relaxed">{scene.closing}</p>
                {caught && title && (
                  <p className="mt-8 font-pixel text-lg text-[#ffd319]" data-testid="ending-title">{title.toUpperCase()}</p>
                )}
                {salary !== undefined && (
                  <p className="mt-3 text-2xl text-paper/80">{formatSalary(salary)} a year</p>
                )}
                <p className="mt-6 max-w-md text-lg text-paper/60">The story is over. Every company you worked for is open for practice.</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <button
          onClick={advance}
          data-testid="cutscene-next"
          className="mt-10 min-h-11 bg-[#ffd319] px-7 py-3 font-pixel text-xs text-[#05060d] shadow-[4px_4px_0_#ff2a6d]"
        >
          {step >= total - 1 ? "FREE PLAY ▶" : "▶"}
        </button>
        <p className="mt-3 font-pixel text-[9px] text-paper/40">{step + 1} / {total}</p>
      </div>
    </div>
  );
}
