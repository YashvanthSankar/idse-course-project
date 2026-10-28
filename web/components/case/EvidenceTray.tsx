"use client";
import { AnimatePresence, motion } from "framer-motion";
import { sfx } from "@/lib/sound";
import { toolMeta } from "@/lib/toolMeta";
import type { Suspect, ToolResult } from "@/lib/types";

export function EvidenceTray({ pinned, suspects, onUnpin, onSelect, onOpenBoard }: {
  pinned: ToolResult[];
  suspects: Suspect[];
  onUnpin: (id: string) => void;
  onSelect: (id: string) => void;
  onOpenBoard?: () => void;
}) {
  const nameOf = (id: string) => suspects.find((s) => s.id === id)?.name.split(" ")[0] ?? id;
  return (
    <section aria-label="Evidence tray" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-type text-[10px] tracking-[0.4em] text-muted">EVIDENCE</h2>
        <span className={`font-mono text-[11px] ${pinned.length >= 2 ? "text-green" : "text-muted"}`}>
          {pinned.length} pinned{pinned.length >= 2 ? " · ready" : " · need 2"}
        </span>
      </div>
      <ul data-testid="evidence-tray" className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pinned.map((r) => (
            <motion.li
              key={r.result_id}
              layout
              initial={{ opacity: 0, y: -12, rotate: -3 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, x: 30 }}
              data-testid="evidence-item"
              className="tex-paper group relative rounded-[2px] p-2.5 pr-7 shadow-[0_6px_14px_rgba(0,0,0,0.5)]"
            >
              <span aria-hidden className="absolute -top-1.5 left-3 h-3 w-3 rounded-full bg-red shadow-[0_2px_3px_rgba(0,0,0,0.5)]" />
              <button onClick={() => onSelect(r.result_id)} className="block w-full text-left">
                <p className="font-type text-[13px] leading-tight">
                  <span className="mr-1 font-display font-bold italic">{toolMeta(r.tool_id).icon}</span>
                  {r.title}
                </p>
                <p className="mt-0.5 text-[11px] opacity-70">
                  {r.implicates.length
                    ? `Points at ${r.implicates.map(nameOf).join(", ")}`
                    : "Points at nobody"}
                </p>
              </button>
              <button
                onClick={() => {
                  sfx.play("rustle");
                  onUnpin(r.result_id);
                }}
                aria-label={`Unpin ${r.title}`}
                className="absolute right-1.5 top-1.5 h-5 w-5 rounded-full text-[13px] leading-none opacity-50 hover:bg-black/10 hover:opacity-100"
              >
                ×
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {pinned.length < 2 &&
          Array.from({ length: 2 - pinned.length }, (_, i) => (
            <li
              key={`slot-${i}`}
              className="rounded-[2px] border border-dashed border-line/80 p-3 text-center font-type text-[11px] text-muted/70"
            >
              Pin a result that points at someone
            </li>
          ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          if (!onOpenBoard) return;
          sfx.play("whoosh");
          onOpenBoard();
        }}
        aria-disabled={!onOpenBoard}
        title={onOpenBoard ? "Open the corkboard (B)" : "Corkboard coming in Task 18"}
        className={`mt-1 rounded-sm border-2 px-3 py-2 font-type text-sm tracking-[0.25em] ${
          onOpenBoard && pinned.length >= 2
            ? "border-red bg-red/15 text-[#ffd9da] shadow-[0_0_20px_rgba(229,72,77,0.25)] hover:bg-red/30"
            : "cursor-not-allowed border-line text-muted"
        }`}
      >
        OPEN BOARD
      </button>
    </section>
  );
}
