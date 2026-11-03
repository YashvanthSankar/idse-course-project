"use client";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Spotlight } from "@/components/accuse/Spotlight";
import { Portrait } from "@/components/case/Portrait";
import { cn } from "@/lib/cn";
import { hashString } from "@/lib/random";
import { sfx } from "@/lib/sound";
import { requiredClues } from "@/lib/accusation";
import { useCaseStore } from "@/lib/store";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { Suspect, ToolResult } from "@/lib/types";
import { EvidencePolaroid } from "./EvidencePolaroid";
import { PinHead, RedString, type Point } from "./RedString";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Line = { id: string; from: Point; to: Point };

function SuspectSlot({ suspect, linked, size, armed, phone, onTap }: {
  suspect: Suspect;
  linked: number;
  size: number;
  armed: boolean;
  phone: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `sus-${suspect.id}` });
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        ref={setNodeRef}
        style={{ width: size }}
        onClick={onTap}
        data-testid="board-suspect"
        data-suspect={suspect.id}
        className={cn(
          "relative cursor-pointer rounded-sm transition-transform duration-200",
          isOver && "scale-[1.07]",
          armed && "hover:scale-[1.04]",
        )}
      >
        <span aria-hidden className="absolute left-1/2 top-[-7px] z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#d7a13a] shadow-[1px_3px_3px_rgba(0,0,0,0.55),inset_-2px_-2px_0_rgba(0,0,0,0.25)]" />
        <Portrait suspect={suspect} size={size} caption={false} highlight={isOver || linked > 0}
          className={cn(isOver && "shadow-[0_0_0_3px_var(--amber),0_0_40px_rgba(245,165,36,0.5)]")} />
        <span data-pin={`sus-${suspect.id}`} aria-hidden className="absolute bottom-[3px] left-1/2 h-1 w-1 -translate-x-1/2" />
        {linked > 0 && (
          <span className="absolute -right-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-red font-mono text-xs text-paper shadow-lg">
            {linked}
          </span>
        )}
      </div>
      <p className="max-w-full truncate rounded-[2px] bg-paper/85 px-1.5 py-0.5 text-center font-type text-[11px] leading-tight text-[#2a1a0c] shadow sm:px-2 sm:text-sm">
        {phone ? suspect.name.split(" ")[0] : suspect.name}
        <span className="hidden text-[11px] opacity-70 sm:block">{suspect.role}</span>
      </p>
      {linked > 2 && (
        <p className="rounded-sm bg-paper/90 px-2 py-1 text-center font-type text-[10px] text-[#8f1d27] shadow sm:text-xs">
          {linked} clues · you&apos;ll pick 2
        </p>
      )}
    </div>
  );
}

function EmptySpace({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "board-empty" });
  return (
    <div ref={setNodeRef} className="min-h-[260px] pt-8">
      {children}
    </div>
  );
}

export function Corkboard({ open, onClose, caseId, suspects, results }: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  suspects: Suspect[];
  results: ToolResult[];
}) {
  const trap = useFocusTrap<HTMLDivElement>(open);
  const links = useCaseStore((s) => s.links);
  const verdict = useCaseStore((s) => s.verdict);
  const budgetLeft = useCaseStore((s) => s.meta?.budget_left ?? 1);
  const allResults = useCaseStore((s) => s.results.length);
  // Career Mode's very hard cases have two fraudsters: accuse both
  const career = useCaseStore((s) => s.meta?.career ?? null);
  const culprits = career?.culprits ?? 1;
  // Quick Case: 2 clues, or whatever you have when the budget is spent (the server agrees).
  // Career Mode: one clue is enough to accuse — the case file asks for the theory and the rows.
  const required = career ? 1 : requiredClues(budgetLeft, allResults);
  const phone = useMediaQuery("(max-width: 639px)") ?? false;
  const surface = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [accusing, setAccusing] = useState<Suspect[]>([]);
  const [pair, setPair] = useState<string[]>([]);
  const lastDrag = useRef(0);
  const frame = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const measure = useCallback(() => {
    const root = surface.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const center = (key: string): Point | null => {
      const el = root.querySelector(`[data-pin="${key}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
    };
    const next: Line[] = [];
    for (const r of results) {
      const sid = links[r.result_id];
      if (!sid) continue;
      const from = center(`ev-${r.result_id}`);
      const to = center(`sus-${sid}`);
      if (from && to) next.push({ id: `${r.result_id}-${sid}`, from, to });
    }
    setLines(next);
  }, [links, results]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    schedule();
    const settle = window.setTimeout(schedule, 520); // after the polaroids land
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame.current);
    };
  }, [open, schedule]);

  useEffect(() => {
    if (!open || accusing.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "b" || e.key === "B") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, accusing, onClose]);

  const link = (rid: string, sid: string) => {
    const st = useCaseStore.getState();
    if (st.links[rid] === sid) return;
    st.link(rid, sid);
    sfx.play("string");
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    lastDrag.current = Date.now();
    const rid = String(active.id);
    const target = over ? String(over.id) : "";
    if (target.startsWith("sus-")) link(rid, target.slice(4));
    else if (useCaseStore.getState().links[rid]) {
      useCaseStore.getState().unlink(rid);
      sfx.play("rustle");
    }
    schedule();
  };

  const count = (sid: string) => results.filter((r) => links[r.result_id] === sid).length;
  const readyList = suspects.filter((s) => count(s.id) >= required);
  // When the two-fraudster bar slides up, bring the clue photos above it (they sit at the bottom)
  const pairBar = culprits > 1 && readyList.length > 0 && !selected;
  useEffect(() => {
    const board = trap.current;
    if (pairBar && board) board.scrollTo({ top: board.scrollHeight, behavior: "smooth" });
  }, [pairBar, trap]);
  const pairPicks = pair.filter((id) => readyList.some((s) => s.id === id));
  const togglePair = (id: string) => {
    sfx.play("tick");
    setPair((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  };

  const closedHere = verdict !== null && useCaseStore.getState().meta?.case_id === caseId;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={trap}
          tabIndex={-1}
          role="dialog"
          aria-modal
          aria-label="Corkboard"
          data-testid="corkboard"
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-[#2b1709] p-2 sm:p-4"
        >
          <div className="tex-cork relative min-h-full rounded-[3px] shadow-[inset_0_0_0_6px_#4a2a12,inset_0_0_60px_rgba(0,0,0,0.65),0_20px_60px_rgba(0,0,0,0.6)]">
            {/* two fraudsters: room at the bottom so the pair picker never covers the photos */}
            <div ref={surface} className={cn("relative mx-auto max-w-6xl px-3 pt-4 sm:px-8 sm:pt-6", culprits > 1 ? "pb-60" : "pb-24")}>
              <header className="relative z-40 mb-6 flex flex-wrap items-start justify-between gap-3">
                <div className="tex-paper -rotate-1 rounded-[2px] px-4 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.5)]">
                  <p className="font-type text-[10px] tracking-[0.35em] opacity-60">EVIDENCE BOARD</p>
                  <h2 className="font-display text-2xl italic leading-tight sm:text-3xl">Connect the dots</h2>
                  <p className="max-w-xs text-[11px] opacity-75 sm:text-xs">
                    Drag a photo onto a suspect — or tap the photo, then the suspect. {career ? "One string that fits the trick makes a case." : "Two strings make a case."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {closedHere && (
                    <Link href={`/case/${caseId}/verdict`} className="rounded-sm border-2 border-amber bg-ink-950/80 px-3 py-2 font-type text-xs tracking-[0.2em] text-amber">
                      CASE CLOSED · VERDICT
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      sfx.play("whoosh");
                      onClose();
                    }}
                    className="rounded-sm border border-paper/40 bg-ink-950/80 px-3 py-2 font-type text-xs tracking-[0.2em] text-paper hover:border-amber hover:text-amber"
                  >
                    ✕ BACK TO THE FILES
                  </button>
                </div>
              </header>

              <DndContext
                sensors={sensors}
                onDragStart={() => sfx.play("rustle")}
                onDragMove={schedule}
                onDragCancel={schedule}
                onDragEnd={onDragEnd}
              >
                <div className="relative z-10 grid grid-cols-5 gap-1.5 sm:gap-6">
                  {suspects.map((s) => (
                    <SuspectSlot
                      key={s.id}
                      suspect={s}
                      size={phone ? 62 : 128}
                      linked={count(s.id)}
                      armed={selected !== null}
                      phone={phone}
                      onTap={() => {
                        if (!selected) return;
                        link(selected, s.id);
                        setSelected(null);
                        schedule();
                      }}
                    />
                  ))}
                </div>

                <EmptySpace>
                  {results.length === 0 ? (
                    <div className="tex-paper mx-auto max-w-sm rotate-1 rounded-[2px] p-6 text-center shadow-xl">
                      <p className="font-display text-xl italic">Nothing pinned yet.</p>
                      <p className="mt-1 font-type text-sm opacity-75">
                        Run tools in the workspace and press “Pin as evidence” on the ones that point at someone.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-8 sm:gap-x-10">
                      {results.map((r, i) => (
                        <motion.div
                          key={r.result_id}
                          initial={{ opacity: 0, y: 30, rotate: 8 }}
                          animate={{ opacity: 1, y: 0, rotate: 0 }}
                          transition={{ delay: 0.06 * i, type: "spring", stiffness: 260, damping: 22 }}
                        >
                          <EvidencePolaroid
                            result={r}
                            suspects={suspects}
                            tilt={((hashString(r.result_id) % 9) - 4) * 1.3}
                            linkedTo={links[r.result_id] ?? null}
                            selected={selected === r.result_id}
                            onSelect={() => {
                              if (Date.now() - lastDrag.current < 250) return;
                              sfx.play("tick");
                              setSelected((cur) => (cur === r.result_id ? null : r.result_id));
                            }}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </EmptySpace>
              </DndContext>

              <svg aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible">
                {lines.map((l) => (
                  <RedString key={l.id} id={l.id} from={l.from} to={l.to} />
                ))}
                {lines.map((l) => (
                  <g key={`${l.id}-pins`}>
                    <PinHead at={l.from} />
                    <PinHead at={l.to} />
                  </g>
                ))}
              </svg>
              <AnimatePresence>
                {culprits > 1 && readyList.length > 0 && !selected && (
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    data-testid="pair-picker"
                    className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 border-t border-white/10 bg-black/90 px-3 pb-4 pt-3 backdrop-blur"
                  >
                    <p className="font-type text-xs tracking-[0.25em] text-paper">
                      TWO FRAUDSTERS · PICK BOTH ({pairPicks.length}/2)
                    </p>
                    {readyList.length < 2 && (
                      <p className="text-xs text-paper/80">Tie a clue to the second fraudster too, then pick both.</p>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                      {readyList.map((suspect) => (
                        <button
                          key={suspect.id}
                          aria-pressed={pairPicks.includes(suspect.id)}
                          onClick={() => togglePair(suspect.id)}
                          className={cn(
                            "min-h-11 rounded-sm border-2 px-4 py-2 font-display text-base italic",
                            pairPicks.includes(suspect.id) ? "border-[#ffd319] bg-[#ffd319]/15 text-[#ffd319]" : "border-paper/30 bg-ink-950/80 text-paper/80",
                          )}
                        >
                          {pairPicks.includes(suspect.id) ? "☑ " : "☐ "}{suspect.name}
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={pairPicks.length !== 2}
                      onClick={() => {
                        sfx.play("whoosh");
                        setAccusing(suspects.filter((s) => pairPicks.includes(s.id)));
                      }}
                      className="animate-pulse-red rounded-sm border-2 border-[#8f1d27] bg-[#c4161c] px-5 py-3 font-type text-sm tracking-[0.2em] text-paper shadow-[0_10px_30px_rgba(196,22,28,0.6)] hover:bg-[#d61f26] disabled:animate-none disabled:opacity-40 sm:text-base"
                    >
                      MAKE THE ACCUSATION
                    </button>
                  </motion.div>
                )}
                {culprits === 1 && readyList.length > 0 && !selected && (
                  <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap justify-center gap-2 px-3 pb-5"
                  >
                    {readyList.map((suspect) => (
                      <button
                        key={suspect.id}
                        onClick={() => {
                          sfx.play("whoosh");
                          setAccusing([suspect]);
                        }}
                        aria-label={readyList.length > 1 ? `Make the accusation against ${suspect.name}` : undefined}
                        className="animate-pulse-red flex items-center gap-3 rounded-sm border-2 border-[#8f1d27] bg-[#c4161c] px-5 py-3 font-type text-sm tracking-[0.2em] text-paper shadow-[0_10px_30px_rgba(196,22,28,0.6)] hover:bg-[#d61f26] sm:text-base sm:tracking-[0.3em]"
                      >
                        MAKE THE ACCUSATION
                        <span className="hidden font-display text-base normal-case italic tracking-normal opacity-90 sm:inline">
                          · {suspect.name}
                        </span>
                        {!career && count(suspect.id) > required && (
                          <span className="font-sans text-xs normal-case tracking-normal opacity-85">
                            pick {required} of {count(suspect.id)}
                          </span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {!career && required < 2 && !selected && (
                <p
                  data-testid="broke-notice"
                  className="fixed left-1/2 top-4 z-40 max-w-[90vw] -translate-x-1/2 rounded-sm bg-ink-950/90 px-4 py-2 text-center text-sm text-amber shadow-xl"
                >
                  Budget spent — you can accuse with {required === 0 ? "no clues" : "the clue you have"}.
                </p>
              )}
              {selected && (
                <p className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-sm bg-ink-950/90 px-4 py-2 font-type text-xs tracking-widest text-amber shadow-xl">
                  NOW TAP A SUSPECT
                </p>
              )}
            </div>
          </div>

          <Spotlight
            caseId={caseId}
            accused={accusing}
            evidenceFor={(id) => results.filter((r) => links[r.result_id] === id)}
            required={required}
            onCancel={() => setAccusing([])}
            onAccused={() => {
              setAccusing([]);
              onClose();
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
