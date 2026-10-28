"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Suspect } from "@/lib/types";
import { Portrait } from "./Portrait";

export function SuspectCard({ suspect, flagged, flaggedBy }: {
  suspect: Suspect;
  flagged: boolean;
  flaggedBy?: string;
}) {
  return (
    <motion.li
      layout
      data-testid="suspect-card"
      data-flagged={flagged}
      className={cn(
        "flex items-center gap-3 rounded-lg p-2 transition-colors",
        flagged ? "bg-red/10 ring-1 ring-red/60" : "hover:bg-white/[0.03]",
      )}
    >
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
    </motion.li>
  );
}
