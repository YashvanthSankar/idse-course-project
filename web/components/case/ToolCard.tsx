"use client";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { PARAM_LABELS, toolMeta } from "@/lib/toolMeta";
import type { ToolSpec } from "@/lib/types";

function Coins({ n, affordable }: { n: number; affordable: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-[3px]" aria-label={`costs ${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            affordable ? "bg-[radial-gradient(circle_at_35%_30%,#ffe29a,#f5a524_60%,#9a6212)]" : "bg-red/50",
          )}
        />
      ))}
    </span>
  );
}

/** One tool on the shelf: a compact row; when selected it opens its settings and Run button. */
export function ToolCard({ spec, hotkey, selected, params, onSelect, onParam, onRun, busy, affordable, lockedLabel }: {
  spec: ToolSpec;
  /** Where the tool unlocks, when that isn't "Case N" (Career Mode: bigger companies). */
  lockedLabel?: string;
  hotkey: number;
  selected: boolean;
  params: Record<string, string>;
  onSelect: () => void;
  onParam: (name: string, value: string) => void;
  onRun: () => void;
  busy: boolean;
  affordable: boolean;
}) {
  const meta = toolMeta(spec.id);
  const locked = !spec.unlocked;
  const choices = Object.entries(spec.params).filter(
    (entry): entry is [string, string[]] => Array.isArray(entry[1]),
  );

  return (
    <li
      data-testid="tool-card"
      data-tool={spec.id}
      data-locked={locked}
      data-selected={selected}
      className={cn(
        "rounded-lg border transition-colors",
        selected ? "border-amber/60 bg-amber/[0.06]" : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (locked) return onSelect();
          sfx.play("tick");
          onSelect();
        }}
        aria-expanded={locked ? undefined : selected}
        aria-label={locked ? `${spec.name} (locked until ${lockedLabel ?? `case ${spec.unlock_level}`})` : spec.name}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
          locked ? "cursor-not-allowed opacity-45" : "hover:bg-white/[0.04]",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[15px] font-semibold",
            locked ? "bg-ink-800 text-muted" : "bg-ink-800 text-amber ring-1 ring-amber/30",
          )}
        >
          {locked ? "🔒" : meta.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] text-paper">{spec.name}</span>
        {locked ? (
          <span className="shrink-0 text-xs text-paper/50">{lockedLabel ?? `Case ${spec.unlock_level}`}</span>
        ) : (
          <>
            <Coins n={spec.cost} affordable={affordable} />
            <kbd className="hidden w-4 shrink-0 text-center font-mono text-[11px] text-paper/35 lg:block">{hotkey}</kbd>
          </>
        )}
      </button>

      <AnimatePresence initial={false}>
        {selected && !locked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
              <p className="text-sm leading-snug text-paper/75">
                {meta.blurb}
                <span className="mt-0.5 block font-mono text-xs text-cyan/70">{meta.lib}</span>
              </p>
              {choices.map(([name, values]) => (
                <div key={name} role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
                  {values.map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={params[name] === v}
                      onClick={() => {
                        sfx.play("tick");
                        onParam(name, v);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[13px]",
                        params[name] === v
                          ? "border-amber bg-amber/15 text-amber"
                          : "border-line text-paper/65 hover:text-paper",
                      )}
                    >
                      {PARAM_LABELS[v] ?? v}
                    </button>
                  ))}
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={onRun}
                aria-label={`Run ${spec.name}`}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md py-2 text-[15px] font-semibold",
                  affordable
                    ? "bg-amber text-ink-950 hover:brightness-110"
                    : "border border-red/60 bg-red/10 text-[#ffd9da]",
                  "disabled:opacity-60",
                )}
              >
                {busy ? "Running…" : `Run · ${spec.cost} coin${spec.cost === 1 ? "" : "s"}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
