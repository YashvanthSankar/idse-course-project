"use client";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Rain } from "@/components/fx/Rain";
import { Typewriter } from "@/components/fx/Typewriter";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { sfx } from "@/lib/sound";
import { Manual } from "./Manual";
import { Skyline } from "./Skyline";

const MENU = [
  { id: "new", label: "New Case" },
  { id: "class", label: "Class Mode" },
  { id: "manual", label: "Detective's Manual" },
  { id: "settings", label: "Settings" },
] as const;

export function TitleScreen() {
  const router = useRouter();
  const pointerX = useMotionValue(0);
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
      <div aria-hidden className="absolute left-[72%] top-[10%] h-28 w-28 rounded-full bg-[#f3ead2] opacity-80 blur-[1px] shadow-[0_0_80px_30px_rgba(243,234,210,0.15)]" />
      <Skyline pointerX={pointerX} />
      <Rain lightning density={340} />

      <div className="relative z-10 mt-[14vh] flex flex-col items-center px-4 text-center">
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.1em" }}
          animate={{ opacity: 0.8, letterSpacing: "0.45em" }}
          transition={{ duration: 2 }}
          className="neon-cyan mb-4 font-type text-xs text-cyan sm:text-sm"
        >
          FORENSIC ACCOUNTING · MUMBAI
        </motion.p>
        <h1 className="animate-neon font-display text-6xl font-black italic leading-none text-[#ffd9da] sm:text-8xl md:text-9xl">
          The Auditor
        </h1>
        <p className="mt-6 h-6 font-type text-sm text-paper/80 sm:text-base">
          <Typewriter text="Every number tells a story. Some of them lie." delay={900} speed={45} sound={false} />
        </p>

        <div className="mt-14 min-h-56 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(7,8,11,0.88)_0%,rgba(7,8,11,0.6)_45%,transparent_72%)] px-16 py-8">
          <AnimatePresence mode="wait">
            {!awake ? (
              <motion.p
                key="press"
                exit={{ opacity: 0 }}
                className="animate-blink font-type text-sm tracking-[0.4em] text-amber"
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
                className="flex flex-col items-center gap-3"
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
                    className={`group font-type text-xl tracking-[0.25em] transition-colors sm:text-2xl ${
                      focus === i ? "text-amber" : "text-paper/60 hover:text-paper"
                    }`}
                  >
                    <span className={`mr-3 inline-block transition-opacity ${focus === i ? "opacity-100" : "opacity-0"}`}>▸</span>
                    {item.label.toUpperCase()}
                  </motion.button>
                ))}
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="absolute bottom-4 z-10 font-mono text-[10px] tracking-widest text-muted/60">
        POWERED BY NUMPY · PANDAS · SCIPY · SCIKIT-LEARN
      </p>

      <Manual open={panel === "manual"} onClose={() => setPanel(null)} />
      <SettingsPanel open={panel === "settings"} onClose={() => setPanel(null)} />
    </main>
  );
}
