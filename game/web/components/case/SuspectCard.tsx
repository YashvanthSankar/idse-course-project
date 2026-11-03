"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Typewriter } from "@/components/fx/Typewriter";
import { interrogate } from "@/lib/api";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import type { Suspect } from "@/lib/types";
import { Portrait } from "./Portrait";

/** A suspect: portrait, role, and a free interrogation whose answer you must check in the data. */
export function SuspectCard({ caseId, suspect, flagged, flaggedBy }: {
  caseId: string;
  suspect: Suspect;
  flagged: boolean;
  flaggedBy?: string;
}) {
  const [statement, setStatement] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    if (statement || asking) return;
    setAsking(true);
    sfx.play("tick");
    try {
      const res = await interrogate(caseId, suspect.id);
      setStatement(res.statement);
      sfx.play("rustle");
    } catch {
      setStatement("…(they refuse to answer)");
    } finally {
      setAsking(false);
    }
  };

  return (
    <motion.li
      layout
      data-testid="suspect-card"
      data-flagged={flagged}
      className={cn(
        "rounded-lg p-2 transition-colors",
        flagged ? "bg-red/10 ring-1 ring-red/60" : "hover:bg-white/[0.03]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-12 shrink-0 rounded-[3px]", flagged && "animate-pulse-red")}>
          <Portrait suspect={suspect} size={48} caption={false} highlight={flagged} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-paper">{suspect.name}</p>
          <p className="truncate text-[13px] text-paper/55">{suspect.role}</p>
          {flagged && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate text-[12px] text-red">
              Flagged by {flaggedBy ?? "the last tool"}
            </motion.p>
          )}
        </div>
        {!statement && (
          <button
            type="button"
            onClick={ask}
            disabled={asking}
            data-testid="question-suspect"
            aria-label={`Question ${suspect.name}`}
            className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-[12px] text-paper/75 transition-colors hover:border-amber/60 hover:text-amber disabled:opacity-50"
          >
            {asking ? "…" : "Question"}
          </button>
        )}
      </div>
      <AnimatePresence>
        {statement && (
          <motion.blockquote
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            data-testid="suspect-statement"
            className="relative ml-[60px] mt-2 rounded-md bg-paper/95 px-3 py-2 font-type text-[13px] leading-snug text-[#2a2418] before:absolute before:-top-1.5 before:left-4 before:h-3 before:w-3 before:rotate-45 before:bg-paper/95"
          >
            “<Typewriter text={statement} speed={18} cursor={false} />”
          </motion.blockquote>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
