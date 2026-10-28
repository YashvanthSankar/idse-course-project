"use client";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { Stamp } from "@/components/fx/Stamp";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";
import type { BoardRow } from "@/lib/ws";

// Revealed 3rd → 2nd → 1st, like an awards night.
const PLACES = [
  { place: 2, height: "h-48", delay: 1.2, color: "#c8ccd4" },
  { place: 1, height: "h-72", delay: 2.4, color: "#f5a524" },
  { place: 3, height: "h-36", delay: 0, color: "#c0854a" },
];

export function Podium({ rows }: { rows: BoardRow[] }) {
  const reduced = useReducedEffects();
  const winners = rows.filter((r) => r.solved && r.correct);

  useEffect(() => {
    if (!reduced && winners.length) sfx.play("drumroll");
  }, [reduced, winners.length]);

  if (!winners.length) {
    return (
      <div data-testid="podium" className="text-center">
        <p className="font-display text-5xl italic text-paper">Nobody caught the fraudster.</p>
        <p className="mt-4 text-2xl text-paper/60">The books stay cooked… for now.</p>
      </div>
    );
  }

  return (
    <div data-testid="podium" className="flex items-end justify-center gap-6">
      {PLACES.map(({ place, height, delay, color }) => {
        const row = winners[place - 1];
        return (
          <div key={place} className="flex w-64 flex-col items-center">
            {row && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : delay, type: "spring", stiffness: 260, damping: 18 }}
                className="mb-4 text-center"
                data-testid={`podium-${place}`}
              >
                {place === 1 && (
                  <div className="mb-2 origin-bottom scale-[0.6]">
                    <Stamp kind="closed" />
                  </div>
                )}
                <p className="font-display text-4xl font-black italic text-paper">{row.name}</p>
                <p className="font-mono text-2xl text-amber">{row.score.toLocaleString()}</p>
              </motion.div>
            )}
            <motion.div
              initial={reduced ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: reduced ? 0 : Math.max(0, delay - 0.4), duration: 0.5, ease: "easeOut" }}
              style={{ originY: 1, background: `linear-gradient(180deg, ${color}55, ${color}15)`, borderColor: color }}
              className={`flex w-full ${height} items-start justify-center rounded-t-lg border-2 border-b-0 pt-4`}
            >
              <span className="font-display text-6xl font-black italic" style={{ color }}>{place}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
