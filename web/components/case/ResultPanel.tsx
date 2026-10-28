"use client";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { formatStat, keyStats, statLabel, withNames } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { PARAM_LABELS, toolMeta } from "@/lib/toolMeta";
import type { Suspect, ToolResult } from "@/lib/types";
import { PlotlyChart } from "./PlotlyChart";
import { TerminalRun } from "./TerminalRun";

export type Running = { toolId: string; params: Record<string, string> } | null;

export function ResultPanel({
  results, active, running, revealed, cached, onRevealed, onSelect, pinned, onPin, onCode, onData, suspects,
}: {
  results: ToolResult[];
  active: ToolResult | null;
  running: Running;
  revealed: Set<string>;
  cached: boolean;
  onRevealed: (id: string) => void;
  onSelect: (id: string) => void;
  pinned: boolean;
  onPin: () => void;
  onCode: () => void;
  onData: () => void;
  suspects: Suspect[];
}) {
  const nameOf = (id: string) => suspects.find((s) => s.id === id)?.name ?? id;
  const names = Object.fromEntries(suspects.map((s) => [s.id, s.name]));
  const phone = useMediaQuery("(max-width: 767px)") ?? false;
  const showTerminal = running !== null || (active !== null && !revealed.has(active.result_id));
  const command = running
    ? `python -m auditor.run ${running.toolId} ${Object.values(running.params).join(" ")}`
    : active
      ? `python -m auditor.run ${active.tool_id} ${Object.values(active.params as Record<string, unknown>).join(" ")}`
      : "";

  return (
    <section aria-label="Workspace" className="flex min-w-0 flex-col gap-3">
      {results.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Results so far">
          {results.map((r) => (
            <button
              key={r.result_id}
              role="tab"
              aria-selected={active?.result_id === r.result_id}
              onClick={() => onSelect(r.result_id)}
              className={cn(
                "shrink-0 rounded-sm border px-2 py-1 font-mono text-[11px]",
                active?.result_id === r.result_id
                  ? "border-amber bg-amber/10 text-amber"
                  : "border-line text-muted hover:text-paper",
              )}
            >
              <span className="mr-1 font-display font-bold italic">{toolMeta(r.tool_id).icon}</span>
              {r.title}
            </button>
          ))}
        </div>
      )}

      <div className="relative min-h-[380px] rounded-lg border border-line bg-ink-900/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-4">
        <AnimatePresence mode="wait">
          {!active && !running ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-[380px] flex-col items-center justify-center text-center"
            >
              <div aria-hidden className="mb-5 font-display text-7xl italic text-amber/30">?</div>
              <p className="font-display text-2xl italic text-paper">The ledger is waiting.</p>
              <p className="mt-2 max-w-sm font-type text-sm text-muted">
                Pick a tool from the kit below. Every tool is real Python — and every one costs budget.
              </p>
            </motion.div>
          ) : showTerminal ? (
            <motion.div key={`term-${running?.toolId ?? active?.result_id}`} exit={{ opacity: 0, scale: 0.98 }}>
              <TerminalRun
                code={running ? null : (active?.code ?? null)}
                command={command}
                onDone={() => active && onRevealed(active.result_id)}
              />
            </motion.div>
          ) : (
            active && (
              <motion.div
                key={`res-${active.result_id}`}
                initial={{ opacity: 0, scale: 0.97, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                data-testid="result-view"
              >
                <header className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl italic text-paper sm:text-2xl">{active.title}</h2>
                  {Object.values(active.params as Record<string, string>).map((v) => (
                    <span key={String(v)} className="rounded-sm border border-cyan/40 px-1.5 font-mono text-[10px] text-cyan">
                      {PARAM_LABELS[String(v)] ?? String(v)}
                    </span>
                  ))}
                  {cached ? (
                    <span data-testid="cached-badge" className="rounded-sm border border-green/50 bg-green/10 px-1.5 font-mono text-[10px] text-green">
                      cached · free
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-amber/80">−{active.cost_charged} budget</span>
                  )}
                </header>
                <PlotlyChart figure={active.figure} height={phone ? 320 : 360} compact={phone} />
                <p className="mt-3 font-type text-[15px] leading-snug text-paper/90">{withNames(active.summary, names)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keyStats(active.stats, active.implicates).map(([k, v]) => {
                    const { label, suspect } = statLabel(k);
                    return (
                      <span key={k} className="rounded border border-line bg-ink-950/70 px-2 py-1 font-mono text-[11px]">
                        <span className="text-muted">{label}</span>
                        {suspect && <span className="text-paper/70"> · {nameOf(suspect).split(" ")[0]}</span>}{" "}
                        <span className="text-amber">{formatStat(k, v)}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
                  <span className="mr-auto font-type text-[13px] text-muted">
                    {active.implicates.length ? (
                      <>
                        Points at{" "}
                        <span className="text-red">{active.implicates.map(nameOf).join(", ")}</span>
                      </>
                    ) : (
                      "Points at nobody"
                    )}
                  </span>
                  <button
                    onClick={onPin}
                    disabled={pinned}
                    className="rounded-sm border-2 border-red/80 bg-red/10 px-3 py-1.5 font-type text-sm tracking-widest text-[#ffd9da] hover:bg-red/25 disabled:border-line disabled:bg-transparent disabled:text-muted"
                  >
                    {pinned ? "📌 Pinned" : "📌 Pin as evidence"}
                  </button>
                  <button
                    onClick={onCode}
                    className="rounded-sm border border-green/50 px-3 py-1.5 font-mono text-xs text-green hover:bg-green/10"
                  >
                    &lt;/&gt; Under the hood
                  </button>
                  <button
                    onClick={onData}
                    className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-paper/80 hover:border-amber hover:text-amber"
                  >
                    ▤ Data
                  </button>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
