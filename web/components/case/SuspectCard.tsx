"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Suspect } from "@/lib/types";
import { Portrait } from "./Portrait";

export function SuspectCard({ suspect, flagged, compact = false }: {
  suspect: Suspect;
  flagged: boolean;
  compact?: boolean;
}) {
  return (
    <motion.li
      layout
      data-testid="suspect-card"
      data-flagged={flagged}
      className={cn(
        "relative flex items-center gap-3 rounded-md border p-2 transition-colors",
        flagged ? "border-red/70 bg-red/10" : "border-line/70 bg-ink-900/60",
      )}
    >
      <div className={cn("rounded-[3px]", flagged && "animate-pulse-red")}>
        <Portrait suspect={suspect} size={compact ? 52 : 62} caption={false} highlight={flagged} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-type text-[13px] text-paper">{suspect.name}</p>
        <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-amber/80">
          {suspect.role}
        </p>
        <p className="truncate text-[10px] text-muted">{suspect.department}</p>
        {flagged && (
          <motion.p
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-red"
          >
            ● flagged
          </motion.p>
        )}
      </div>
    </motion.li>
  );
}
