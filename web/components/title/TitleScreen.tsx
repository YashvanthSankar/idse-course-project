"use client";
import { motion, useMotionValue } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Rain } from "@/components/fx/Rain";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { CAREER_ENABLED } from "@/lib/career";
import { progressSummary, totalScore } from "@/lib/progress";
import { rankFor } from "@/lib/rank";
import { sfx } from "@/lib/sound";
import { useProgress } from "@/lib/useProgress";
import { Manual } from "./Manual";
import { Skyline } from "./Skyline";

// The stable mode stays on top, so switching Career Mode off never moves what a presenter
// rehearsed. Options live behind the gear.
const ALL_MENU = [
  { id: "new", label: "QUICK CASE", hint: "Solve a fraud case on your own" },
  { id: "career", label: "CAREER", hint: "From a sweet shop in Dadar to the Kaveri Inquiry" },
  { id: "class", label: "CLASS MODE", hint: "The whole class plays live from their phones" },
  { id: "manual", label: "MANUAL", hint: "How to play, and every tool in the kit" },
] as const;
const MENU = ALL_MENU.filter((item) => item.id !== "career" || CAREER_ENABLED);

// The attract-mode ticker: a ledger scrolling past, with one claim that doesn't belong.
const LEDGER = [
  "412.00", "1,208.50", "96.00", "2,150.00", "460.00", "6,800.00", "131.25", "14,700.00",
  "88.40", "3,020.00", "512.75", "31,600.00", "245.00", "1,990.00", "702.30", "48,750.00",
  "118.00", "5,430.00", "390.00", "9,860.00", "72.50", "2,640.00", "1,004.00", "620.00",
];
const OUTLIER_INDEX = 15;

const pad = (n: number) => String(n).padStart(6, "0");

export function TitleScreen() {
  const router = useRouter();
  const pointerX = useMotionValue(0);
  const progress = useProgress();
  const summary = progressSummary(progress);
  const rank = rankFor(totalScore(progress));
  const [awake, setAwake] = useState(false);
  const [focus, setFocus] = useState(0);
  const [panel, setPanel] = useState<"manual" | "settings" | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => pointerX.set(e.clientX / window.innerWidth - 0.5);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerX]);

  const choose = (id: (typeof MENU)[number]["id"]) => {
    sfx.play("coin");
    if (id === "new") router.push("/office");
    else if (id === "career") router.push("/career");
    else if (id === "class") router.push("/host");
    else setPanel(id);
  };

  useEffect(() => {
    const wake = () => {
      if (awake) return;
      sfx.unlock();
      sfx.loop("rain");
      sfx.loop("jazz");
      setAwake(true);
    };
    const onKey = (e: KeyboardEvent) => {
      wake();
      if (panel) return;
      if (e.key === "ArrowDown") {
        sfx.play("tick");
        setFocus((f) => (f + 1) % MENU.length);
      }
      if (e.key === "ArrowUp") {
        sfx.play("tick");
        setFocus((f) => (f + MENU.length - 1) % MENU.length);
      }
      if (e.key === "Enter") choose(MENU[focus].id);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", wake);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", wake);
    };
  });

  const ticker = [...LEDGER, ...LEDGER];

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#05060d] font-terminal text-paper">
      {/* ── the night: a pixel moon, the city, the rain ─────────────────── */}
      <svg aria-hidden viewBox="0 0 12 12" className="pixel absolute right-[7%] top-[16%] h-12 w-12 sm:right-[5%] sm:top-[9%] opacity-90 sm:h-20 sm:w-20" shapeRendering="crispEdges">
        <path fill="#f3ead2" d="M4 0h4v1h2v1h1v2h1v4h-1v2h-1v1H8v1H4v-1H2v-1H1V8H0V4h1V2h1V1h2z" />
        <path fill="#d9cdb0" d="M3 3h2v2H3zM7 6h2v2H7zM4 8h1v1H4z" />
      </svg>
      <Skyline pointerX={pointerX} />
      <Rain density={220} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(to_top,#05060d_30%,transparent)]" />

      {/* ── arcade HUD ───────────────────────────────────────────────────── */}
      <header className="relative z-10 grid grid-cols-3 items-start px-4 pt-4 font-pixel text-[9px] leading-[1.8] sm:px-8 sm:pt-6 sm:text-xs">
        <div>
          <p className="text-[#ff2a6d]">1UP</p>
          <p className="text-paper">{pad(summary.best)}</p>
        </div>
        <div className="text-center">
          <p className="text-[#ff2a6d]">HI-SCORE</p>
          <p className="text-paper">{pad(Math.max(summary.best, 1880))}</p>
        </div>
        <div className="text-right">
          <p className="text-[#ff2a6d]">RANK</p>
          <p className="text-paper">{rank.title.toUpperCase()} · {summary.closed}/7</p>
        </div>
      </header>

      {/* ── the marquee ──────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-6 pt-8 text-center">
        <p className="font-pixel text-[10px] tracking-[0.2em] text-[#4cc9f0] sm:text-sm">A DATA DETECTIVE GAME</p>
        <motion.h1
          aria-label="Outlier"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 14 }}
          className="mt-5 font-pixel leading-none"
          style={{ fontSize: "clamp(2.4rem, 10.5vw, 9.5rem)", letterSpacing: "0.02em" }}
        >
          <span aria-hidden className="arcade-logo animate-hop">O</span>
          <span aria-hidden className="arcade-logo">UTLIER</span>
        </motion.h1>
        <p className="mt-7 max-w-[30ch] text-balance text-[1.6rem] leading-tight text-paper/90 sm:max-w-none sm:text-[2.1rem]">
          Every number tells a story. Some of them lie.
        </p>

        {/* the menu */}
        <nav aria-label="Main menu" className="mt-9 flex flex-col items-start gap-1">
          {MENU.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => {
                if (focus !== i) sfx.play("tick");
                setFocus(i);
              }}
              onFocus={() => setFocus(i)}
              onClick={() => choose(item.id)}
              className={`flex min-h-11 items-center gap-4 font-pixel text-sm transition-colors sm:text-lg ${
                focus === i ? "text-[#ffd319]" : "text-paper/75 hover:text-paper"
              }`}
            >
              <span aria-hidden className={focus === i ? "animate-blink-hard" : "invisible"}>▶</span>
              {item.label}
            </button>
          ))}
        </nav>
        <p className="mt-5 h-8 text-2xl text-[#4cc9f0] sm:text-[1.7rem]" aria-live="polite">{MENU[focus].hint}</p>
      </section>

      {/* ── attract mode: the ledger ticker, one claim doesn't belong ────── */}
      <div aria-hidden className="relative z-10 overflow-hidden border-y-2 border-[#1a2238] bg-[#080b16]/90 py-2">
        <div className="animate-ticker flex w-max gap-10 whitespace-nowrap text-2xl sm:text-3xl">
          {ticker.map((n, i) =>
            i % LEDGER.length === OUTLIER_INDEX ? (
              <span key={i} className="bg-[#ff2a6d] px-2 text-[#05060d]">₹{n} ◀ ?!</span>
            ) : (
              <span key={i} className="text-[#3dd68c]/80">₹{n}</span>
            ),
          )}
        </div>
      </div>

      <footer className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 font-pixel text-[8px] text-paper/50 sm:px-8 sm:text-[10px]">
        <span className="flex items-center gap-3">
          <button
            onClick={() => {
              sfx.play("coin");
              setPanel("settings");
            }}
            aria-label="Options"
            title="Options: sound, effects and unlocking cases"
            className="flex h-11 w-11 items-center justify-center rounded border-2 border-[#1a2238] text-xl text-paper/70 hover:border-[#ffd319] hover:text-[#ffd319]"
          >
            ⚙
          </button>
          <span>© 2026 IDSE<span className="hidden sm:inline"> · NUMPY · PANDAS · SCIPY · SKLEARN</span></span>
        </span>
        <span className="animate-blink-hard text-[#ffd319]">{awake ? "CREDIT 01" : "INSERT COIN"}</span>
      </footer>

      {/* ── the glass: scanlines, bezel, flicker ─────────────────────────── */}
      <div aria-hidden className="crt-scanlines animate-crt pointer-events-none fixed inset-0 z-[60]" />
      <div aria-hidden className="crt-bezel pointer-events-none fixed inset-0 z-[61]" />

      <Manual open={panel === "manual"} onClose={() => setPanel(null)} />
      <SettingsPanel open={panel === "settings"} onClose={() => setPanel(null)} />
    </main>
  );
}
