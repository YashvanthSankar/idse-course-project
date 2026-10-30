"use client";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { finding, type Tone } from "@/lib/headline";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { PARAM_LABELS, toolMeta } from "@/lib/toolMeta";
import type { Suspect, ToolResult } from "@/lib/types";
import { PlotlyChart } from "./PlotlyChart";
import { TerminalRun } from "./TerminalRun";

export type Running = { toolId: string; params: Record<string, string> } | null;

const PILL: Record<Tone, string> = {
  guilty: "bg-red/15 text-[#ffb3b5] ring-red/50",
  weak: "bg-amber/15 text-amber ring-amber/45",
  clear: "bg-white/[0.06] text-paper/70 ring-white/15",
  info: "bg-cyan/10 text-cyan ring-cyan/35",
};
const DOT: Record<Tone, string> = { guilty: "bg-red", weak: "bg-amber", clear: "bg-paper/50", info: "bg-cyan" };

const ghost =
  "whitespace-nowrap rounded-md border border-line px-2 py-2 text-sm text-paper/80 transition-colors hover:border-paper/40 hover:text-paper sm:px-3.5";

export function ResultPanel({
  results, active, running, revealed, cached, onRevealed, onSelect, pinned, onPin, onCode, onData, suspects, phone, broke = false,
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
  phone: boolean;
  /** the budget is spent: the only way forward is the board */
  broke?: boolean;
}) {
  const names = Object.fromEntries(suspects.map((s) => [s.id, s.name]));
  const tall = useMediaQuery("(min-height: 860px)") ?? false;
  const showTerminal = running !== null || (active !== null && !revealed.has(active.result_id));
  const command = running
    ? `python -m auditor.run ${running.toolId} ${Object.values(running.params).join(" ")}`
    : active
      ? `python -m auditor.run ${active.tool_id} ${Object.values(active.params as Record<string, unknown>).join(" ")}`
      : "";
  const found = active ? finding(active, names) : null;
  const paramText = active
    ? Object.values(active.params as Record<string, unknown>)
        .filter((v) => typeof v === "string")
        .map((v) => PARAM_LABELS[v as string] ?? v)
        .join(" · ")
    : "";

  return (
    <section aria-label="Workspace" className="flex min-w-0 flex-col gap-3">
      {results.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Results so far">
          <span className="mr-1 shrink-0 text-xs text-paper/45">Results</span>
          {results.map((r) => (
            <button
              key={r.result_id}
              role="tab"
              aria-selected={active?.result_id === r.result_id}
              onClick={() => onSelect(r.result_id)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3 py-1 text-[13px] transition-colors",
                active?.result_id === r.result_id
                  ? "bg-amber/15 text-amber ring-1 ring-amber/50"
                  : "text-paper/60 ring-1 ring-line hover:text-paper",
              )}
            >
              <span className="mr-1.5 font-mono font-semibold">{toolMeta(r.tool_id).icon}</span>
              {r.title.split(" · ")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="relative rounded-xl border border-line/80 bg-ink-900/75 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-6">
        <AnimatePresence mode="wait">
          {!active && !running ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[360px] flex-col items-center justify-center text-center"
            >
              <div aria-hidden className="mb-4 font-display text-6xl italic text-amber/40">?</div>
              <p className="font-display text-3xl italic text-paper">{broke ? "The budget is spent." : "The ledger is waiting."}</p>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-paper/65">
                {broke
                  ? "Open the board and make your accusation with what you have."
                  : `${phone ? "Open the Tools tab" : "← Pick a tool from the kit"} to examine the ledger. Every tool is real Python, and every one costs budget.`}
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
            active &&
            found && (
              <motion.div
                key={`res-${active.result_id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                data-testid="result-view"
              >
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-paper/55">
                  <span className="font-mono text-sm font-semibold text-amber">{toolMeta(active.tool_id).icon}</span>
                  <span>{active.title.split(" · ")[0]}</span>
                  {paramText && <span>· {paramText}</span>}
                  {cached ? (
                    <span data-testid="cached-badge" className="rounded-full bg-green/10 px-2 py-0.5 text-xs text-green ring-1 ring-green/40">
                      re-run · free
                    </span>
                  ) : (
                    <span>· cost {active.cost_charged}</span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                  <h2 data-testid="result-headline" className="max-w-2xl font-display text-2xl leading-tight text-paper sm:text-[28px]">
                    {found.headline}
                  </h2>
                  <span
                    data-testid="verdict-pill"
                    data-tone={found.tone}
                    className={cn("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1", PILL[found.tone])}
                  >
                    <span className={cn("h-2 w-2 rounded-full", DOT[found.tone])} />
                    {found.pill}
                  </span>
                </div>

                <div className="mt-4">
                  <PlotlyChart figure={active.figure} height={phone ? 300 : tall ? 380 : 320} compact={phone} hideTitle />
                </div>

                <p className="mt-3 text-[15px] leading-relaxed text-paper/65">{found.detail}</p>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-line/60 pt-4 sm:flex sm:flex-wrap sm:items-center">
                  <button
                    onClick={onPin}
                    disabled={pinned}
                    className="col-span-2 rounded-md bg-red px-4 py-2 text-[15px] font-semibold text-paper shadow-[0_6px_20px_rgba(229,72,77,0.25)] transition hover:brightness-110 disabled:bg-transparent disabled:text-paper/50 disabled:shadow-none disabled:ring-1 disabled:ring-line"
                  >
                    {pinned ? "📌 Pinned" : "📌 Pin as evidence"}
                  </button>
                  <button onClick={onCode} className={cn(ghost, "text-green/90 hover:text-green")}>
                    &lt;/&gt; Under the hood
                  </button>
                  <button onClick={onData} className={ghost}>
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
