"use client";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Rain } from "@/components/fx/Rain";
import { Typewriter } from "@/components/fx/Typewriter";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { progressSummary } from "@/lib/progress";
import { sfx } from "@/lib/sound";
import { useProgress } from "@/lib/useProgress";
import { Manual } from "./Manual";
import { Skyline } from "./Skyline";

const MENU = [
  { id: "new", label: "New Case", hint: "Solve a fraud case on your own" },
  { id: "class", label: "Class Mode", hint: "The whole class plays live from their phones" },
  { id: "manual", label: "Detective's Manual", hint: "How to play, and every tool in the kit" },
  { id: "settings", label: "Settings", hint: "Sound, effects and unlocking cases" },
] as const;

export function TitleScreen() {
  const router = useRouter();
  const pointerX = useMotionValue(0);
  const summary = progressSummary(useProgress());
  const [awake, setAwake] = useState(false);
  const [focus, setFocus] = useState(0);
  const [panel, setPanel] = useState<"manual" | "settings" | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => pointerX.set(e.clientX / window.innerWidth - 0.5);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerX]);

  const choose = (id: (typeof MENU)[number]["id"]) => {
    sfx.play("pin");
    if (id === "new") router.push("/office");
    else if (id === "class") router.push("/host");
    else setPanel(id);
  };

  useEffect(() => {
    const wake = () => {
      if (awake) return;
      sfx.unlock();
      sfx.loop("rain");
      sfx.loop("jazz");
      sfx.play("buzz");
      setAwake(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!awake) return wake();
      if (panel) return;
      if (e.key === "ArrowDown") setFocus((f) => (f + 1) % MENU.length);
      if (e.key === "ArrowUp") setFocus((f) => (f + MENU.length - 1) % MENU.length);
      if (e.key === "Enter") choose(MENU[focus].id);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", wake);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", wake);
    };
  });

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,#1b2540_0%,#0b0f1a_45%,#07080b_100%)]">
      <div aria-hidden className="absolute right-[7%] top-[3%] h-14 w-14 rounded-full bg-[#f3ead2] opacity-80 blur-[1px] shadow-[0_0_60px_20px_rgba(243,234,210,0.12)] sm:left-[72%] sm:right-auto sm:top-[10%] sm:h-28 sm:w-28 sm:shadow-[0_0_80px_30px_rgba(243,234,210,0.15)]" />
      {/* two searchlights sweeping the night sky behind the city */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[22%] h-[85%] overflow-hidden">
        <div className="animate-searchlight absolute bottom-0 left-[18%] h-[120%] w-40 origin-bottom bg-[linear-gradient(to_top,rgba(76,201,240,0.16),transparent_85%)] [clip-path:polygon(46%_100%,54%_100%,100%_0,0_0)]" />
        <div className="animate-searchlight-slow absolute bottom-0 right-[16%] h-[120%] w-48 origin-bottom bg-[linear-gradient(to_top,rgba(245,165,36,0.12),transparent_85%)] [clip-path:polygon(46%_100%,54%_100%,100%_0,0_0)]" />
      </div>
      <Skyline pointerX={pointerX} />
      {/* low fog rolling between the buildings */}
      <div aria-hidden className="pointer-events-none absolute inset-x-[-20%] bottom-[14%] h-[34%]">
        <div className="animate-fog absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(160,180,210,0.16),transparent_60%)] blur-2xl" />
        <div className="animate-fog-slow absolute inset-0 bg-[radial-gradient(ellipse_at_75%_60%,rgba(160,180,210,0.12),transparent_55%)] blur-3xl" />
      </div>
      <Rain lightning density={340} />

      <div className="relative z-10 mt-[14vh] flex flex-col items-center px-4 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 2 }}
          className="mb-3 font-poster text-base tracking-[0.22em] text-cyan [text-shadow:0_0_10px_rgba(76,201,240,0.55)] sm:text-2xl sm:tracking-[0.4em]"
        >
          FORENSIC ACCOUNTING · MUMBAI
        </motion.p>
        <h1 className="animate-neon font-display text-[3.4rem] font-black italic leading-none text-[#ffd9da] sm:text-8xl md:text-9xl">
          The Auditor
        </h1>
        <p className="mt-5 min-h-8 text-balance font-display text-lg italic text-paper/85 sm:text-2xl">
          <Typewriter text="Every number tells a story. Some of them lie." delay={900} speed={45} sound={false} />
        </p>

        <div className="mt-10 min-h-56 w-full max-w-md rounded-2xl border border-white/10 bg-ink-950/75 px-4 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-md sm:mt-12 sm:px-8">
          <AnimatePresence mode="wait">
            {!awake ? (
              <motion.p
                key="press"
                exit={{ opacity: 0 }}
                className="animate-blink font-poster text-2xl tracking-[0.3em] text-amber"
              >
                PRESS ANY KEY
              </motion.p>
            ) : (
              <motion.nav
                key="menu"
                aria-label="Main menu"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.12 } } }}
                className="flex flex-col items-center gap-1"
              >
                {MENU.map((item, i) => (
                  <motion.button
                    key={item.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    onMouseEnter={() => {
                      setFocus(i);
                      sfx.play("tick");
                    }}
                    onClick={() => choose(item.id)}
                    className={`group relative min-h-12 whitespace-nowrap px-7 font-poster text-[1.7rem] leading-none tracking-[0.08em] transition-colors sm:px-8 sm:text-[2.6rem] sm:tracking-[0.12em] ${
                      focus === i
                        ? "text-amber [text-shadow:0_0_18px_rgba(245,165,36,0.45)]"
                        : "text-paper/70 hover:text-paper"
                    }`}
                  >
                    <span aria-hidden className={`absolute left-0 top-1/2 -translate-y-1/2 text-[0.6em] transition-opacity ${focus === i ? "opacity-100" : "opacity-0"}`}>▸</span>
                    <span className="mr-3 align-middle font-mono text-xs tracking-normal text-paper/40 sm:text-sm">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item.label.toUpperCase()}
                    <span aria-hidden className={`absolute right-0 top-1/2 -translate-y-1/2 text-[0.6em] transition-opacity ${focus === i ? "opacity-100" : "opacity-0"}`}>◂</span>
                  </motion.button>
                ))}
                <motion.p
                  key={MENU[focus].id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 border-t border-white/10 pt-4 text-sm text-paper/70 sm:text-base"
                >
                  {MENU[focus].hint}
                </motion.p>
                <p className="mt-1 text-xs text-paper/45">
                  {summary.closed > 0
                    ? `${summary.closed} of 7 cases closed · best score ${summary.best.toLocaleString("en-IN")}`
                    : "↑ ↓ to choose · Enter to open"}
                </p>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="absolute inset-x-4 bottom-4 z-10 text-center font-mono text-[9px] tracking-widest text-paper/45 sm:text-[11px]">
        POWERED BY NUMPY · PANDAS · SCIPY · SCIKIT-LEARN
      </p>

      <Manual open={panel === "manual"} onClose={() => setPanel(null)} />
      <SettingsPanel open={panel === "settings"} onClose={() => setPanel(null)} />
    </main>
  );
}
