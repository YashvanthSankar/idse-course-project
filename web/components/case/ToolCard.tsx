"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { PARAM_LABELS, toolMeta } from "@/lib/toolMeta";
import type { ToolSpec } from "@/lib/types";

export function ToolCard({ spec, hotkey, params, onParam, onRun, busy, affordable }: {
  spec: ToolSpec;
  hotkey: number;
  params: Record<string, string>;
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
    <motion.div
      data-testid="tool-card"
      data-tool={spec.id}
      data-locked={locked}
      whileHover={locked ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={cn(
        "group relative flex w-full flex-col rounded-md border p-2.5 text-left md:w-[198px] md:shrink-0",
        locked
          ? "border-line/50 bg-ink-900/40 opacity-50 grayscale"
          : "border-line bg-[linear-gradient(160deg,#1a2030,#10141c)] hover:border-amber/70 hover:shadow-[0_8px_30px_rgba(245,165,36,0.12)]",
      )}
      title={locked ? `Unlocks at Case ${spec.unlock_level}` : `${meta.blurb} — ${meta.lib}`}
    >
      <button
        type="button"
        disabled={locked || busy}
        onClick={() => {
          if (locked) return sfx.play("buzz");
          onRun();
        }}
        aria-label={locked ? `${spec.name} (locked)` : `Run ${spec.name}`}
        className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 disabled:cursor-not-allowed"
      />
      <div className="pointer-events-none relative z-10 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber/40 bg-ink-950 font-display text-base font-bold italic text-amber">
          {meta.icon}
        </span>
        <p className="min-w-0 flex-1 font-type text-[13px] leading-tight text-paper md:truncate">{spec.name}</p>
        <span className="flex shrink-0 items-center gap-[3px]" title={`Costs ${spec.cost}`}>
          {Array.from({ length: spec.cost }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full border",
                affordable ? "border-[#8a5a10] bg-amber" : "border-red/60 bg-red/40",
              )}
            />
          ))}
        </span>
      </div>
      <p className="pointer-events-none relative z-10 mt-1 truncate text-[11px] text-muted">{meta.blurb}</p>
      <p className="pointer-events-none relative z-10 truncate font-mono text-[9.5px] text-cyan/70">{meta.lib}</p>

      {locked ? (
        <p className="relative z-10 mt-1.5 font-type text-[10px] tracking-widest text-red/80">
          🔒 UNLOCKS AT CASE {spec.unlock_level}
        </p>
      ) : (
        choices.map(([name, values]) => (
          <div key={name} role="radiogroup" aria-label={name} className="relative z-10 mt-1.5 flex flex-wrap gap-1 pr-5">
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
                  "rounded-sm border px-1.5 font-mono text-[10px] leading-5",
                  params[name] === v
                    ? "border-amber bg-amber/15 text-amber"
                    : "border-line text-muted hover:text-paper",
                )}
              >
                {PARAM_LABELS[v] ?? v}
              </button>
            ))}
          </div>
        ))
      )}
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 hidden rounded-sm border border-line px-1 font-mono text-[9px] text-muted md:block">
        {hotkey}
      </span>
    </motion.div>
  );
}
