"use client";
import { SHELVES } from "@/lib/toolMeta";
import type { ToolSpec } from "@/lib/types";
import { ToolCard } from "./ToolCard";

export function ToolKit({ specs, params, selected, onSelect, onParam, onRun, busy, budgetLeft }: {
  specs: ToolSpec[];
  params: Record<string, Record<string, string>>;
  selected: string | null;
  onSelect: (spec: ToolSpec) => void;
  onParam: (tool: string, name: string, value: string) => void;
  onRun: (spec: ToolSpec) => void;
  busy: boolean;
  budgetLeft: number;
}) {
  const byId = new Map(specs.map((s, i) => [s.id as string, { spec: s, hotkey: i + 1 }]));
  return (
    <section aria-label="Tool kit" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl italic text-paper">Tool kit</h2>
        <p className="hidden text-xs text-paper/45 lg:block">keys 1–9 run instantly</p>
      </div>
      {SHELVES.map((shelf) => (
        <div key={shelf.title}>
          <h3 className="mb-1 px-2.5 text-xs font-medium uppercase tracking-[0.18em] text-paper/45">{shelf.title}</h3>
          <ul className="flex flex-col gap-0.5">
            {shelf.tools.map((id) => {
              const entry = byId.get(id);
              if (!entry) return null;
              const { spec, hotkey } = entry;
              return (
                <ToolCard
                  key={id}
                  spec={spec}
                  hotkey={hotkey}
                  selected={selected === id}
                  params={params[id] ?? {}}
                  onSelect={() => onSelect(spec)}
                  onParam={(name, value) => onParam(id, name, value)}
                  onRun={() => onRun(spec)}
                  busy={busy}
                  affordable={spec.cost <= budgetLeft}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
