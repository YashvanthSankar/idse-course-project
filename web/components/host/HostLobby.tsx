"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { listLevels } from "@/lib/api";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import type { LobbyPlayer } from "@/lib/ws";
import { JoinPanel } from "./JoinPanel";

export const ROUND_LENGTHS = [3, 6, 10] as const;

export function HostLobby({
  code, players, level, minutes, onLevel, onMinutes, onStart, canStart,
}: {
  code: string;
  players: LobbyPlayer[];
  level: number;
  minutes: number;
  onLevel: (level: number) => void;
  onMinutes: (minutes: number) => void;
  onStart: () => void;
  canStart: boolean;
}) {
  const levels = useQuery({ queryKey: ["levels"], queryFn: listLevels });
  const online = players.filter((p) => p.connected);

  return (
    <div className="grid flex-1 gap-10 px-10 pb-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="flex items-center justify-center rounded-2xl border border-line bg-ink-900/60 p-8">
        <JoinPanel code={code} />
      </section>

      <section className="flex min-w-0 flex-col gap-8">
        <div>
          <p data-testid="joined-count" className="font-display text-6xl font-black italic text-paper">
            {online.length} {online.length === 1 ? "detective" : "detectives"} joined
          </p>
          <div className="mt-6 flex max-h-[34vh] flex-wrap content-start gap-3 overflow-y-auto pr-2">
            <AnimatePresence>
              {players.map((p) => (
                <motion.span
                  key={p.player_id}
                  data-testid="name-chip"
                  layout
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: p.connected ? 1 : 0.4 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                  className="rounded-full border border-amber/40 bg-amber/10 px-5 py-2 text-xl text-paper"
                >
                  {p.name}
                </motion.span>
              ))}
            </AnimatePresence>
            {players.length === 0 && (
              <p className="text-xl text-paper/50">Waiting for the first phone to scan the code…</p>
            )}
          </div>
        </div>

        <div className="mt-auto space-y-6">
          <div>
            <p className="mb-3 text-lg text-paper/70">Choose the case</p>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {(levels.data ?? []).filter((l) => l.level <= 6).map((l) => (
                <button
                  key={l.level}
                  data-testid="level-card"
                  onClick={() => {
                    onLevel(l.level);
                    sfx.play("tick");
                  }}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition",
                    level === l.level
                      ? "border-amber bg-amber/10 shadow-[0_0_24px_rgba(245,165,36,0.2)]"
                      : "border-line bg-ink-900/60 hover:border-paper/40",
                  )}
                >
                  <span className="block font-mono text-sm text-paper/50">Case {String(l.level).padStart(2, "0")}</span>
                  <span className="block font-display text-xl italic text-paper">{l.title}</span>
                  <span className="text-sm text-red">{"★".repeat(l.difficulty)}<span className="text-paper/20">{"★".repeat(5 - l.difficulty)}</span></span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="mb-2 text-lg text-paper/70">Round length</p>
              <div className="flex overflow-hidden rounded-lg border border-line">
                {ROUND_LENGTHS.map((m) => (
                  <button
                    key={m}
                    onClick={() => onMinutes(m)}
                    className={cn(
                      "px-6 py-3 font-mono text-xl transition",
                      minutes === m ? "bg-amber text-ink-950" : "text-paper/70 hover:bg-ink-800",
                    )}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
            <button
              data-testid="start-round"
              onClick={onStart}
              disabled={!canStart}
              className="ml-auto rounded-lg bg-red px-16 py-5 font-type text-3xl tracking-[0.3em] text-white shadow-[0_0_50px_rgba(229,72,77,0.55)] ring-2 ring-[#ff8a8e]/60 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-ink-800 disabled:text-paper/40 disabled:shadow-none disabled:ring-0"
            >
              START
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
