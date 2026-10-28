"use client";
import { motion, useMotionValue } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Rain } from "@/components/fx/Rain";
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

  const letters = ["O", "U", "T", "L", "I", "E", "R"];

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070a12]">
      {/* the city, low and dark, with the moon behind it */}
      <div aria-hidden className="absolute left-[44%] top-[7%] h-16 w-16 rounded-full bg-[#f3ead2] opacity-70 shadow-[0_0_70px_24px_rgba(243,234,210,0.12)] sm:h-24 sm:w-24" />
      <Skyline pointerX={pointerX} />
      <div aria-hidden className="pointer-events-none absolute inset-x-[-20%] bottom-[14%] h-[34%]">
        <div className="animate-fog absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(160,180,210,0.14),transparent_60%)] blur-2xl" />
      </div>
      <Rain lightning density={300} />
      {/* darken the lower half so the monument reads over the lights */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(to_top,#070a12_35%,transparent)]" />

      {/* top corners: what this is / the menu */}
      <header className="relative z-10 flex items-start justify-between gap-6 px-5 pt-5 sm:px-8 sm:pt-7">
        <p className="max-w-[22ch] text-[15px] leading-snug text-paper/85 sm:text-lg">
          A detective game. Catch the fraudster with real statistics.
          <span className="block text-paper/50">
            {summary.closed > 0
              ? `${summary.closed} of 7 cases closed · best ${summary.best.toLocaleString("en-IN")}`
              : "Mumbai · 2 AM · raining"}
          </span>
        </p>
        <nav aria-label="Main menu" className="flex flex-col items-end gap-1 text-right">
          {MENU.map((item, i) => (
            <button
              key={item.id}
              onMouseEnter={() => {
                setFocus(i);
                sfx.play("tick");
              }}
              onFocus={() => setFocus(i)}
              onClick={() => choose(item.id)}
              className={`min-h-11 text-xl font-medium leading-tight transition-colors sm:text-2xl ${
                focus === i ? "text-amber [text-shadow:0_0_16px_rgba(245,165,36,0.4)]" : "text-paper/80 hover:text-paper"
              }`}
            >
              {item.label}
            </button>
          ))}
          <p className="mt-2 hidden max-w-[28ch] text-base text-paper/60 sm:block" aria-live="polite">
            {MENU[focus].hint}
          </p>
        </nav>
      </header>

      {/* the monument: the name fills the width, and one letter is the outlier */}
      <h1
        aria-label="Outlier"
        className="relative z-10 mt-auto flex w-full items-end justify-between px-5 pb-2 font-title font-black uppercase leading-none text-[#e8e6e1] sm:px-8"
        style={{ fontSize: "clamp(3.2rem, 17.5vw, 19rem)" }}
      >
        {letters.map((ch, i) => (
          <motion.span
            key={i}
            aria-hidden
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: i === 0 ? "-0.22em" : 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 120, damping: 18 }}
            className={i === 0 ? "animate-neon text-[#ffd9da]" : ""}
          >
            {ch}
          </motion.span>
        ))}
      </h1>
      <p className="relative z-10 px-5 pb-5 text-base text-paper/70 sm:px-8 sm:pb-7 sm:text-lg">
        <span className="text-[#ffd9da]">One</span> of them doesn&apos;t fit. Find out who.
        <span className="float-right hidden text-paper/40 sm:inline">numpy · pandas · scipy · scikit-learn</span>
      </p>

      <Manual open={panel === "manual"} onClose={() => setPanel(null)} />
      <SettingsPanel open={panel === "settings"} onClose={() => setPanel(null)} />
    </main>
  );
}
