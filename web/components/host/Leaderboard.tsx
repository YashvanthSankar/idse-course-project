"use client";
import { LayoutGroup, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { BoardRow } from "@/lib/ws";

export function Leaderboard({ rows }: { rows: BoardRow[] }) {
  if (rows.length === 0) {
    return <p className="text-2xl text-paper/50">No accusations yet. The detectives are digging…</p>;
  }
  return (
    <LayoutGroup>
      <ol className="space-y-2" data-testid="leaderboard">
        {rows.map((row) => (
          <motion.li
            key={row.player_id}
            layout
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            data-testid="leaderboard-row"
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2 sm:gap-5 sm:px-5 sm:py-3",
              row.rank === 1 && row.solved ? "border-amber/60 bg-amber/10" : "border-line bg-ink-900/70",
            )}
          >
            <span className="w-7 font-display text-xl font-black italic text-paper/50 sm:w-10 sm:text-3xl">{row.rank}</span>
            <span className="min-w-0 flex-1 truncate text-lg text-paper sm:text-2xl">{row.name}</span>
            {row.solved && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:px-3 sm:py-1 sm:text-sm",
                  row.correct ? "bg-green/15 text-green" : "bg-red/15 text-red",
                )}
              >
                {row.correct ? "caught them" : "wrong suspect"}
              </span>
            )}
            <span className="w-16 shrink-0 text-right font-mono text-lg font-bold text-amber sm:w-28 sm:text-3xl">{row.score.toLocaleString()}</span>
          </motion.li>
        ))}
      </ol>
    </LayoutGroup>
  );
}
