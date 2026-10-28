"use client";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
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
  const ready = pinned.length >= 2;
  return (
    <section aria-label="Evidence tray" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl italic text-paper">Evidence</h2>
        <span data-testid="evidence-count" className={cn("text-sm tabular-nums", ready ? "text-green" : "text-paper/55")}>
          {pinned.length <= 2 ? `${pinned.length} of 2${ready ? " ✓" : ""}` : `${pinned.length} pinned · you'll file 2`}
        </span>
      </div>
      <ul data-testid="evidence-tray" className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pinned.map((r) => (
            <motion.li
              key={r.result_id}
              layout
              initial={{ opacity: 0, y: -10, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, x: 30 }}
              data-testid="evidence-item"
              className="tex-paper relative rounded-[3px] py-2.5 pl-3 pr-8 shadow-[0_6px_14px_rgba(0,0,0,0.5)]"
            >
              <span aria-hidden className="absolute -top-1.5 left-3 h-3 w-3 rounded-full bg-red shadow-[0_2px_3px_rgba(0,0,0,0.5)]" />
              <button onClick={() => onSelect(r.result_id)} className="block w-full text-left">
                <p className="text-[14px] font-semibold leading-tight">
                  <span className="mr-1.5 font-mono">{toolMeta(r.tool_id).icon}</span>
                  {r.title.split(" · ")[0]}
                </p>
                <p className="mt-0.5 text-[13px] opacity-75">
                  {r.implicates.length ? `Points at ${r.implicates.map(nameOf).join(" & ")}` : "Points at nobody"}
                </p>
              </button>
              <button
                onClick={() => {
                  sfx.play("rustle");
                  onUnpin(r.result_id);
                }}
                aria-label={`Unpin ${r.title}`}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-base opacity-50 hover:bg-black/10 hover:opacity-100"
              >
                ×
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
        {pinned.length < 2 && (
          <li className="rounded-[3px] border border-dashed border-line px-3 py-4 text-center text-sm leading-snug text-paper/55">
            {pinned.length === 0
              ? "Pin 2 results that point at the same person"
              : "Pin 1 more result to build your case"}
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={() => {
          if (!onOpenBoard) return;
          sfx.play("whoosh");
          onOpenBoard();
        }}
        aria-disabled={!onOpenBoard}
        title="Open the corkboard (B)"
        className={cn(
          "rounded-md px-3 py-2.5 text-[15px] font-semibold tracking-wide",
          ready
            ? "bg-red text-paper shadow-[0_0_24px_rgba(229,72,77,0.35)] hover:brightness-110"
            : "border border-line text-paper/50 hover:text-paper/80",
        )}
      >
        <span aria-hidden className="mr-2">📌</span>
        <span className="sr-only">OPEN BOARD</span>
        <span aria-hidden>{ready ? "Open the board & accuse" : "Open the board"}</span>
      </button>
    </section>
  );
}
