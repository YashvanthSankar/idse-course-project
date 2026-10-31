"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Rain } from "@/components/fx/Rain";
import { Typewriter } from "@/components/fx/Typewriter";
import { normaliseCode } from "@/lib/career";
import { loadPlayer, MAX_NAME, setPlayerName } from "@/lib/player";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";

// The first night at the Bureau (CAREER.md §6): four short panels, then three envelopes.
const PANELS = [
  {
    kicker: "THE BUREAU",
    text: "Mumbai. 2 AM. Monsoon. The Bureau of Forensic Audit sits above a closed bank on Mint Road: three rooms, one working fan, and a Chief who hasn't slept since 2009. Companies come here when they think someone inside is stealing from them and they can't prove it. You are the new hire. Your desk was cleared this morning. Nobody says what happened to the last one.",
  },
  {
    kicker: "HOW A CASE ARRIVES",
    text: "A company hands over its expense ledger: every claim, every invoice, every payment for ninety days. They give us the names of the people who could have touched the money. One of them did. The ledger knows which one. Your job is to make it say so.",
  },
  {
    kicker: "READING A LEDGER",
    text: "Every row is a decision someone made. Most of them are honest. Learn what honest looks like first.",
    ledger: true,
  },
  {
    kicker: "THE RULE OF THE JOB",
    text: "You get a budget. Every tool costs coins and you can't run them all, so think before you spend. One accusation per case: name the trick, show the clue that proves it, pin the rows. And remember this: an outlier is a question, not an answer. Big isn't crooked. Strange isn't guilty. Prove it.",
  },
] as const;

const COLUMNS = [
  ["date", "when"],
  ["hour", "what time"],
  ["employee", "who claimed it"],
  ["vendor", "who got paid"],
  ["category", "what for"],
  ["amount", "₹ claimed"],
  ["revenue", "the deal it served"],
] as const;
const ROWS = [
  ["2026-08-19", "13", "E2", "Colaba Brasserie", "client_meal", "2,140.00", "41,900"],
  ["2026-08-19", "16", "E4", "CityGlide Cabs", "cab", "455.50", "9,310"],
  ["2026-08-20", "11", "E1", "Lamington Road Electronics", "equipment", "30,980.00", "6,12,400"],
];

export function Prologue({ onStart, onContinue, starting, error, enterCode = false }: {
  onStart: () => void;
  onContinue: (code: string) => void;
  starting: boolean;
  error: string | null;
  /** open straight on the "I have a code" form (from the hub's "Enter another code") */
  enterCode?: boolean;
}) {
  const reduced = useReducedEffects();
  const [step, setStep] = useState(enterCode ? PANELS.length : 0);
  const [typed, setTyped] = useState(-1);
  const [entering, setEntering] = useState(enterCode);
  const [code, setCode] = useState("");
  // only rendered on the client (CareerScreen waits for localStorage), so the saved name is safe to read here
  const [name, setName] = useState(() => loadPlayer().name);
  const last = step === PANELS.length;

  useEffect(() => {
    sfx.loop("rain");
  }, []);

  const next = () => {
    if (last) return;
    sfx.play("rustle");
    setStep((s) => s + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (entering || (e.target as HTMLElement)?.closest("input")) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        if (!last) next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const panel = PANELS[step];
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#05060d] text-paper">
      <Rain density={140} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(245,165,36,0.10),transparent_60%)]" />
      <header className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-8">
        <p className="font-pixel text-[10px] text-[#4cc9f0] sm:text-xs">CAREER · PROLOGUE</p>
        {!last && (
          <button
            onClick={() => {
              sfx.play("tick");
              setStep(PANELS.length);
            }}
            className="min-h-11 font-pixel text-[10px] text-paper/60 hover:text-[#ffd319] sm:text-xs"
          >
            SKIP ▶▶
          </button>
        )}
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-10">
        <AnimatePresence mode="wait">
          {!last ? (
            <motion.article
              key={step}
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="tex-paper rounded-[2px] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.7)] sm:p-9"
            >
              <p className="font-type text-[11px] tracking-[0.4em] opacity-60">
                {step + 1} / {PANELS.length} · {panel.kicker}
              </p>
              <p className="mt-4 min-h-[9rem] font-type text-base leading-relaxed sm:text-lg">
                <Typewriter text={panel.text} speed={16} onDone={() => setTyped(step)} />
              </p>
              {"ledger" in panel && (
                <div className="mt-5 overflow-x-auto" data-testid="prologue-ledger">
                  <table className="w-full min-w-[560px] border-collapse font-mono text-[12px]">
                    <thead>
                      <tr>
                        {COLUMNS.map(([col, what]) => (
                          <th key={col} className="border-b-2 border-black/40 px-2 pb-1 text-left align-bottom">
                            <span className="block font-bold">{col}</span>
                            <span className="block font-type text-[10px] font-normal italic opacity-70">{what}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map((row) => (
                        <tr key={row[3]} className="border-b border-black/15">
                          {row.map((cell, i) => (
                            <td key={i} className={i >= 5 ? "px-2 py-1 text-right tabular-nums" : "px-2 py-1"}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <motion.button
                  onClick={next}
                  animate={typed === step && !reduced ? { scale: [1, 1.05, 1] } : undefined}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="min-h-11 bg-[#ffd319] px-6 py-3 font-pixel text-xs text-[#05060d] shadow-[4px_4px_0_#ff2a6d]"
                >
                  {step === PANELS.length - 1 ? "TO YOUR DESK ▶" : "NEXT ▶"}
                </motion.button>
              </div>
            </motion.article>
          ) : (
            <motion.div
              key="envelopes"
              initial={reduced ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="relative h-40 w-72" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={reduced ? false : { x: 0, y: -80, rotate: 0, opacity: 0 }}
                    animate={{ x: (i - 1) * 64, y: 0, rotate: (i - 1) * 9, opacity: 1 }}
                    transition={{ delay: reduced ? 0 : 0.2 + i * 0.25, type: "spring", stiffness: 120, damping: 14 }}
                    onAnimationStart={() => !reduced && sfx.play("whoosh")}
                    className="tex-paper absolute left-1/2 top-4 h-28 w-44 -translate-x-1/2 rounded-[2px] shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
                  >
                    <div className="absolute inset-x-0 top-0 h-14 bg-[linear-gradient(160deg,transparent_49%,rgba(0,0,0,0.12)_50%),linear-gradient(200deg,transparent_49%,rgba(0,0,0,0.12)_50%)]" />
                    <div className="absolute left-1/2 top-11 h-6 w-6 -translate-x-1/2 rounded-full bg-[#8f1d27]" />
                  </motion.div>
                ))}
              </div>
              <h1 className="mt-6 font-display text-4xl italic sm:text-5xl">Three envelopes on your desk.</h1>
              <p className="mt-3 max-w-md text-lg text-paper/75">
                Three small businesses want an auditor. Pick one. The bigger firms are watching who does well.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim() || starting) return;
                  sfx.play("stamp");
                  setPlayerName(name);
                  onStart();
                }}
                className="mt-8 flex w-full max-w-sm flex-col items-center gap-3"
              >
                <label htmlFor="career-name" className="font-type text-[11px] tracking-[0.4em] text-paper/60">
                  SIGN YOUR NAME
                </label>
                <input
                  id="career-name"
                  value={name}
                  maxLength={MAX_NAME}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your detective name"
                  data-testid="career-name"
                  className="h-12 w-full rounded border-2 border-[#1a2238] bg-black/40 px-3 text-center font-type text-xl text-paper outline-none placeholder:text-paper/30 focus:border-[#ffd319]"
                />
                <button
                  type="submit"
                  disabled={starting || !name.trim()}
                  data-testid="start-career"
                  className="min-h-11 bg-[#ffd319] px-8 py-4 font-pixel text-sm text-[#05060d] shadow-[4px_4px_0_#ff2a6d] disabled:opacity-60"
                >
                  {starting ? "OPENING…" : "OPEN THE ENVELOPES"}
                </button>
              </form>
              {!entering ? (
                <button onClick={() => setEntering(true)} className="mt-5 min-h-11 text-base text-[#4cc9f0] underline-offset-4 hover:underline">
                  I already have a career code
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim()) onContinue(normaliseCode(code));
                  }}
                  className="mt-5 flex items-center gap-2"
                >
                  <label htmlFor="career-code" className="sr-only">Career code</label>
                  <input
                    id="career-code"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ABC-DEF"
                    maxLength={9}
                    className="h-11 w-36 rounded border-2 border-[#1a2238] bg-black/40 px-3 text-center font-pixel text-sm uppercase tracking-widest text-paper outline-none focus:border-[#ffd319]"
                  />
                  <button type="submit" className="h-11 border-2 border-[#4cc9f0] px-4 font-pixel text-xs text-[#4cc9f0] hover:bg-[#4cc9f0]/10">
                    CONTINUE
                  </button>
                </form>
              )}
              {error && <p role="alert" className="mt-4 text-base text-red">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
