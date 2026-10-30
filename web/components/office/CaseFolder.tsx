"use client";
import { motion } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { mulberry32 } from "@/lib/random";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";
import type { LevelInfo } from "@/lib/types";

const TAB_POS = ["left-[8%]", "left-[38%]", "right-[8%]"];

/** A manila case folder lying on the desk. */
export function CaseFolder({ info, locked, best, opening, onOpen }: {
  info: LevelInfo;
  locked: boolean;
  best?: number;
  opening: boolean;
  onOpen: () => void;
}) {
  const reduced = useReducedEffects();
  const r = mulberry32(info.level * 7919);
  const rotate = (r() - 0.5) * 7;
  const sheetShift = 4 + r() * 10;
  const clip = r() < 0.5;
  const lastHover = useRef(0);
  const endless = info.level === 7;

  return (
    <motion.button
      type="button"
      data-testid="case-folder"
      data-locked={String(locked)}
      aria-disabled={locked}
      aria-label={`Case ${info.level}: ${info.title}${locked ? " (sealed)" : ""}`}
      onClick={() => {
        if (locked || opening) {
          if (locked) sfx.play("buzz");
          return;
        }
        sfx.play("pin");
        onOpen();
      }}
      onHoverStart={() => {
        if (locked) return;
        const now = performance.now();
        if (now - lastHover.current > 250) sfx.play("rustle");
        lastHover.current = now;
      }}
      initial={reduced ? false : { opacity: 0, y: 30, rotate: rotate * 2 }}
      animate={{ opacity: 1, y: 0, rotate }}
      whileHover={locked || reduced ? undefined : { y: -12, rotate: rotate * 0.3, scale: 1.035 }}
      whileTap={locked ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: reduced ? 0 : info.level * 0.06 }}
      className={cn(
        "group relative w-full pt-5 text-left outline-none",
        locked ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      {/* Folder tab */}
      <div
        className={cn(
          "tex-manila absolute top-0 z-10 h-7 w-[34%] rounded-t-md border border-b-0 border-[#a8844a]/60 px-2 pt-1 font-type text-[11px] tracking-widest",
          TAB_POS[info.level % 3],
        )}
      >
        No. {String(info.level).padStart(2, "0")}
      </div>

      {/* Sheets of paper peeking out of the folder */}
      <div
        className="tex-paper absolute inset-x-[5%] top-[18px] h-16 rounded-sm opacity-95 shadow"
        style={{ transform: `translateX(${sheetShift}px) rotate(${rotate * -0.4}deg)` }}
      />
      <div className="tex-paper absolute inset-x-[7%] top-[20px] h-16 rounded-sm opacity-90 shadow" />

      {/* Folder body */}
      <div
        className={cn(
          "tex-manila relative overflow-hidden rounded-[3px] rounded-tl-none border border-[#a8844a]/60 p-4 pb-5 transition-shadow duration-300 sm:p-5",
          "shadow-[0_14px_22px_rgba(0,0,0,0.55),0_2px_0_rgba(255,255,255,0.15)_inset]",
          !locked && "group-hover:shadow-[0_34px_45px_rgba(0,0,0,0.65),0_0_0_1px_rgba(245,165,36,0.35)]",
          !locked && "group-focus-visible:ring-2 group-focus-visible:ring-amber",
        )}
      >
        {clip && (
          <div aria-hidden className="absolute -top-1 right-6 h-10 w-3.5 rounded-full border-[2.5px] border-[#aab0ba] shadow-sm" />
        )}
        <p className="font-type text-[10px] tracking-[0.3em] opacity-70">BUREAU OF FORENSIC AUDIT</p>

        {/* Typed label sticker */}
        <div className="tex-paper mt-2 rounded-[2px] border border-black/10 px-3 py-2 shadow-sm">
          <p className="font-type text-[10px] tracking-[0.25em] opacity-60">
            {endless ? "OPEN FILE" : `CASE FILE · No. ${String(info.level).padStart(2, "0")}`}
          </p>
          <h3 className="font-display text-lg font-bold italic leading-tight sm:text-xl">
            {endless ? "∞ " : ""}
            {info.title}
          </h3>
        </div>

        <p className="mt-3 min-h-10 font-type text-[13px] leading-snug opacity-85">{info.teaser}</p>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div aria-label={`Difficulty ${info.difficulty} of 5`} className="text-[15px] leading-none tracking-wider">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < info.difficulty ? "text-[#8f1d27]" : "opacity-25"}>
                ★
              </span>
            ))}
          </div>
          <span className="font-mono text-[11px] opacity-75">BUDGET {info.budget}</span>
        </div>

        {/* Solved: red ink rubber stamp with the best score */}
        {best !== undefined && !locked && (
          <div
            aria-label={`Best score ${best}`}
            className="pointer-events-none absolute bottom-10 right-3 rotate-[-9deg] rounded border-[3px] border-double border-[#a3121f]/80 px-2 py-0.5 text-center font-type leading-none text-[#a3121f]/85 mix-blend-multiply"
          >
            <div className="text-[11px] tracking-[0.3em]">SOLVED</div>
            <div className="font-mono text-base font-bold">{best}</div>
          </div>
        )}

        {/* Locked: sealed with evidence tape */}
        {locked && (
          <>
            <div className="absolute inset-0 bg-[#1a1208]/45" />
            <div className="absolute left-[-20%] top-[42%] w-[140%] -rotate-[18deg] bg-[repeating-linear-gradient(90deg,#b3141f_0_12px,#c81e2a_12px_24px)] py-1.5 text-center font-type text-[11px] font-bold tracking-[0.35em] text-[#ffe9d6] shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
              SEALED EVIDENCE
            </div>
            <div className="absolute left-[-20%] top-[60%] w-[140%] rotate-[12deg] bg-[repeating-linear-gradient(90deg,#b3141f_0_12px,#c81e2a_12px_24px)] py-1 text-center font-type text-[10px] tracking-[0.35em] text-[#ffe9d6]/90 shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
              DO NOT OPEN
            </div>
          </>
        )}

        {opening && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1208]/55 font-type text-sm tracking-[0.3em] text-paper">
            <span className="animate-blink">PULLING THE FILE…</span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

export function FolderSkeleton({ index }: { index: number }) {
  return (
    <div className="relative w-full pt-5" style={{ transform: `rotate(${((index * 37) % 7) - 3}deg)` }}>
      <div className="absolute left-[8%] top-0 h-7 w-[34%] rounded-t-md bg-[#d9b878]/25" />
      <div className="h-56 animate-pulse rounded-[3px] bg-[#d9b878]/25" />
    </div>
  );
}
