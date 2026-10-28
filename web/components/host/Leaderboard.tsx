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
              "flex items-center gap-5 rounded-lg border px-5 py-3",
              row.rank === 1 && row.solved ? "border-amber/60 bg-amber/10" : "border-line bg-ink-900/70",
            )}
          >
            <span className="w-10 font-display text-3xl font-black italic text-paper/50">{row.rank}</span>
            <span className="min-w-0 flex-1 truncate text-2xl text-paper">{row.name}</span>
            {row.solved && (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  row.correct ? "bg-green/15 text-green" : "bg-red/15 text-red",
                )}
              >
                {row.correct ? "caught them" : "wrong suspect"}
              </span>
            )}
            <span className="w-28 text-right font-mono text-3xl font-bold text-amber">{row.score.toLocaleString()}</span>
          </motion.li>
        ))}
      </ol>
    </LayoutGroup>
  );
}
