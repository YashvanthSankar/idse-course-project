"use client";
import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { toolMeta } from "@/lib/toolMeta";
import type { Suspect, ToolResult } from "@/lib/types";

type PlotlyLike = { toImage: (fig: object, opts: object) => Promise<string> };
const thumbs = new Map<string, Promise<string>>();

/** A static PNG of the result's chart, rendered once per result and cached. */
function thumbnail(result: ToolResult): Promise<string> {
  const hit = thumbs.get(result.result_id);
  if (hit) return hit;
  const job = import("plotly.js-dist-min").then(({ default: plotly }) => {
    const figure = result.figure as { data?: unknown[]; layout?: Record<string, unknown> };
    const layout = {
      ...figure.layout,
      title: { text: "" },
      showlegend: false,
      paper_bgcolor: "#0e1117",
      plot_bgcolor: "#0e1117",
      margin: { l: 34, r: 8, t: 8, b: 26 },
      width: 360,
      height: 230,
    };
    return (plotly as unknown as PlotlyLike).toImage({ data: figure.data ?? [], layout },
      { format: "png", width: 360, height: 230, scale: 1 });
  });
  thumbs.set(result.result_id, job);
  job.catch(() => thumbs.delete(result.result_id));
  return job;
}

export function EvidencePolaroid({ result, suspects, tilt, linkedTo, selected, onSelect }: {
  result: ToolResult;
  suspects: Suspect[];
  tilt: number;
  linkedTo: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: result.result_id,
  });

  useEffect(() => {
    let alive = true;
    thumbnail(result).then((url) => alive && setSrc(url)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [result]);

  const meta = toolMeta(result.tool_id);
  const first = (id: string) => suspects.find((s) => s.id === id)?.name.split(" ")[0] ?? id;
  const lifted = isDragging ? " scale(1.06)" : "";
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${tilt / 2}deg)${lifted}` }
    : { transform: `rotate(${tilt}deg)` };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      data-testid="board-evidence"
      data-result={result.result_id}
      data-linked={linkedTo ?? ""}
      style={style}
      className={cn(
        "tex-paper relative w-[150px] cursor-grab touch-none select-none rounded-[2px] p-2 pb-2.5 sm:w-[190px]",
        "shadow-[0_12px_24px_rgba(0,0,0,0.55)] transition-shadow active:cursor-grabbing",
        isDragging && "z-50 shadow-[0_30px_50px_rgba(0,0,0,0.7)]",
        selected && "outline outline-[3px] outline-offset-2 outline-amber",
      )}
    >
      <span data-pin={`ev-${result.result_id}`} aria-hidden
        className="absolute left-1/2 top-[-6px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#c4161c] shadow-[1px_3px_3px_rgba(0,0,0,0.5),inset_-2px_-2px_0_rgba(0,0,0,0.25)]" />
      <div className="relative aspect-[36/23] overflow-hidden rounded-[1px] bg-ink-900">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Chart: ${result.title}`} draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-amber/70">
            <span className="font-display text-3xl font-bold italic">{meta.icon}</span>
            <span className="font-mono text-[9px] tracking-widest text-muted">developing…</span>
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),transparent_40%)]" />
      </div>
      <p className="mt-1.5 truncate font-type text-[12px] leading-tight sm:text-[13px]">
        <span className="mr-1 font-display font-bold italic">{meta.icon}</span>
        {result.title}
      </p>
      <p className="truncate text-[10px] opacity-70 sm:text-[11px]">
        {result.implicates.length ? `points at ${result.implicates.map(first).join(", ")}` : "points at nobody"}
      </p>
      {linkedTo && (
        <p className="mt-0.5 font-type text-[10px] tracking-widest text-[#8f1d27]">→ {first(linkedTo).toUpperCase()}</p>
      )}
    </div>
  );
}
