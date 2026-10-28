"use client";
import type { ToolSpec } from "@/lib/types";
import { ToolCard } from "./ToolCard";

export function ToolKit({ specs, params, onParam, onRun, busy, budgetLeft }: {
  specs: ToolSpec[];
  params: Record<string, Record<string, string>>;
  onParam: (tool: string, name: string, value: string) => void;
  onRun: (spec: ToolSpec) => void;
  busy: boolean;
  budgetLeft: number;
}) {
  return (
    <section aria-label="Tool kit" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-type text-[10px] tracking-[0.4em] text-muted">TOOL KIT</h2>
        <p className="hidden font-mono text-[10px] text-muted/70 md:block">press 1–9 · re-runs are free</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:gap-3 md:overflow-x-auto md:pb-1">
        {specs.map((spec, i) => (
          <ToolCard
            key={spec.id}
            spec={spec}
            hotkey={i + 1}
            params={params[spec.id] ?? {}}
            onParam={(name, value) => onParam(spec.id, name, value)}
            onRun={() => onRun(spec)}
            busy={busy}
            affordable={spec.cost <= budgetLeft}
          />
        ))}
      </div>
    </section>
  );
}
