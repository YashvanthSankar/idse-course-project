"use client";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";
import type { BoardRow } from "@/lib/ws";

// Revealed 3rd → 2nd → 1st, like an awards night. Blocks scale with the screen's height.
const PLACES = [
  { place: 2, height: "clamp(4rem, 17vh, 12rem)", delay: 1.2, color: "#c8ccd4" },
  { place: 1, height: "clamp(5rem, 25vh, 18rem)", delay: 2.4, color: "#f5a524" },
  { place: 3, height: "clamp(3rem, 12vh, 9rem)", delay: 0, color: "#c0854a" },
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
    <div data-testid="podium" className="flex w-full items-end justify-center gap-2 sm:gap-6">
      {PLACES.filter(({ place }) => place <= winners.length).map(({ place, height, delay, color }) => {
        const row = winners[place - 1];
        // with fewer than three winners, the reveal starts with the lowest real place
        const shift = PLACES.find((p) => p.place === winners.length)!.delay;
        return (
          <div key={place} className="flex min-w-0 flex-1 flex-col items-center sm:max-w-64">
            {row && (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : delay - shift, type: "spring", stiffness: 260, damping: 18 }}
                className="mb-4 w-full text-center"
                data-testid={`podium-${place}`}
              >
                <p className="break-words font-display text-xl font-black italic leading-tight text-paper sm:text-4xl">{row.name}</p>
                <p className="font-mono text-lg text-amber sm:text-2xl">{row.score.toLocaleString()}</p>
              </motion.div>
            )}
            <motion.div
              initial={reduced ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: reduced ? 0 : Math.max(0, delay - shift - 0.4), duration: 0.5, ease: "easeOut" }}
              style={{ originY: 1, height, background: `linear-gradient(180deg, ${color}55, ${color}15)`, borderColor: color }}
              className="flex w-full items-start justify-center rounded-t-lg border-2 border-b-0 pt-4"
            >
              <span className="font-display text-6xl font-black italic" style={{ color }}>{place}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
