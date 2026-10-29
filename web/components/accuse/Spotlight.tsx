"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Portrait } from "@/components/case/Portrait";
import { Typewriter } from "@/components/fx/Typewriter";
import { clueWarning, defaultPick } from "@/lib/accusation";
import { useAccused } from "@/lib/accused";
import { ApiError, accuse, careerAccuse } from "@/lib/api";
import { browserStorage, loadProgress, recordResult, saveProgress } from "@/lib/progress";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";
import { useCaseStore } from "@/lib/store";
import { toolMeta } from "@/lib/toolMeta";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedEffects } from "@/lib/useReducedEffects";
import type { Suspect, ToolResult } from "@/lib/types";
import { HoldToConfirm } from "./HoldToConfirm";

const LINES = [
  "You've got nothing on me, auditor.",
  "Numbers? Numbers can say anything.",
  "Check again. I've got receipts.",
];

/** The interrogation-room moment: the accused (one, or two in Career Mode's very hard cases),
 *  one lamp, one irreversible decision. */
export function Spotlight({ caseId, accused, evidenceFor, required = 2, onCancel, onAccused }: {
  caseId: string;
  /** who stands in the light — empty when the room is closed */
  accused: Suspect[];
  evidenceFor: (suspectId: string) => ToolResult[];
  /** how many clues must be filed per accused (2, or fewer when the budget is spent) */
  required?: number;
  onCancel: () => void;
  onAccused: () => void;
}) {
  const router = useRouter();
  const reduced = useReducedEffects();
  const phone = useMediaQuery("(max-width: 639px)") ?? false;
  const short = useMediaQuery("(max-height: 820px)") ?? false;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = accused.length > 0;
  const pair = accused.length > 1;
  const career = useCaseStore((s) => s.meta?.career ?? null);
  const suspects = useCaseStore((s) => s.meta?.suspects ?? []);
  const nameOf = (id: string) => suspects.find((x) => x.id === id)?.name.split(" ")[0] ?? id;

  // Which clues get filed for each accused. Re-picked whenever the accused or their clues change.
  const pickKey = accused.map((s) => `${s.id}:${evidenceFor(s.id).map((r) => r.result_id).join(",")}`).join("|") + `:${required}`;
  const [picked, setPicked] = useState<{ key: string; ids: Record<string, string[]> }>({ key: "", ids: {} });
  const chosenFor = (s: Suspect) =>
    picked.key === pickKey && picked.ids[s.id] ? picked.ids[s.id] : defaultPick(evidenceFor(s.id), s.id, required);
  const choosingAny = accused.some((s) => evidenceFor(s.id).length > required);
  // Choosing clues adds a list: shrink the portrait so the hold button stays on screen
  const compact = pair || (choosingAny && (short || phone));
  const ready = accused.every((s) => chosenFor(s).length === required);
  const toggle = (s: Suspect, id: string) => {
    sfx.play("tick");
    const current = chosenFor(s);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-required); // picking a third drops the oldest pick
    const all = Object.fromEntries(accused.map((a) => [a.id, chosenFor(a)]));
    setPicked({ key: pickKey, ids: { ...all, [s.id]: next } });
  };

  useEffect(() => {
    if (!open) return;
    sfx.loop("heartbeat");
    return () => sfx.stop("heartbeat");
  }, [open]);

  useEffect(() => {
    if (!open || pending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  const confirm = async () => {
    if (!open) return;
    setPending(true);
    setError(null);
    try {
      const store = useCaseStore.getState();
      if (career) {
        const verdict = await careerAccuse(caseId, accused.map((s) => ({ suspect_id: s.id, evidence_ids: chosenFor(s) })));
        store.setCareerVerdict(verdict);
      } else {
        const verdict = await accuse(caseId, accused[0].id, chosenFor(accused[0]));
        store.setVerdict(verdict);
        const level = store.meta?.level ?? 1;
        const storage = browserStorage();
        saveProgress(storage, recordResult(loadProgress(storage), level, verdict.correct, verdict.score));
      }
      useAccused.getState().set(caseId, accused[0].id);
      sfx.stop("heartbeat");
      onAccused();
      router.push(`/case/${caseId}/verdict`);
    } catch (err) {
      setPending(false);
      sfx.play("buzz");
      setError(err instanceof ApiError ? err.detail : "The line went dead. Try again.");
    }
  };

  const lineFor = (s: Suspect) => LINES[s.id.charCodeAt(s.id.length - 1) % LINES.length];

  const exhibits = (s: Suspect) => {
    const evidence = evidenceFor(s.id);
    const choosing = evidence.length > required;
    const chosen = chosenFor(s);
    return (
      <div className="w-full">
        {choosing && (
          <p className="mb-3 text-sm text-paper/80">
            You tied {evidence.length} clues to {s.name.split(" ")[0]}. Choose the {required} you&apos;ll file.
          </p>
        )}
        <ul className="flex flex-wrap justify-center gap-2" data-testid="exhibits">
          {evidence.map((r) => {
            const on = chosen.includes(r.result_id);
            const warn = clueWarning(r, s.id, nameOf);
            const body = (
              <>
                <span className="block font-mono text-[12px] text-paper">
                  <span className="mr-1.5 font-display font-bold not-italic">{toolMeta(r.tool_id).icon}</span>
                  {r.title}
                </span>
                {warn && (
                  <span className={cn("mt-0.5 block text-xs", warn.tone === "bad" ? "text-red" : "text-amber")}>
                    {career ? warn.text.replace(/ · −100$/, "") : warn.text}
                  </span>
                )}
              </>
            );
            return (
              <li key={r.result_id}>
                {choosing ? (
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s, r.result_id)}
                    disabled={pending}
                    className={cn(
                      "min-h-11 rounded-sm border px-3 py-2 text-left transition-colors",
                      on ? "border-amber bg-amber/15" : "border-line bg-ink-900/90 opacity-70 hover:opacity-100",
                    )}
                  >
                    <span className="mr-2 text-amber">{on ? "☑" : "☐"}</span>
                    {body}
                  </button>
                ) : (
                  <div className="rounded-sm border border-line bg-ink-900/90 px-3 py-2 text-left">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        {choosing && (
          <p className="mt-2 text-xs tabular-nums text-paper/60">
            {chosen.length} of {required} chosen
          </p>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={`Accuse ${accused.map((s) => s.name).join(" and ")}`}
          data-testid="spotlight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[140] overflow-y-auto overflow-x-hidden bg-black"
        >
          {/* the lamp's cone and the darkness around it */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[75vh] w-[min(760px,140vw)] -translate-x-1/2 origin-top"
            style={{
              clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)",
              background: "linear-gradient(180deg, rgba(255,226,170,0.32), rgba(255,210,140,0.06) 70%, transparent)",
            }}
            animate={reduced ? undefined : { rotate: [-1.5, 1.5, -1.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-3 w-24 -translate-x-1/2 rounded-b-full bg-[#2a2a2a] shadow-[0_6px_30px_rgba(255,220,160,0.6)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,transparent_0,transparent_150px,rgba(0,0,0,0.88)_340px)]" />

          <div className={cn("relative flex min-h-full flex-col items-center px-4 pb-10 text-center", compact ? "pt-[3vh]" : "pt-[8vh]")}>
            {pair ? (
              <>
                <p className="font-type text-[11px] tracking-[0.45em] text-red">THE ACCUSED · BOTH OF THEM</p>
                <div className="mt-4 grid w-full max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2" data-testid="accused-pair">
                  {accused.map((s, i) => (
                    <motion.section
                      key={s.id}
                      aria-label={`Clues against ${s.name}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.2, type: "spring", stiffness: 140, damping: 16 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <Portrait suspect={s} size={phone ? 104 : 140} highlight />
                      <div>
                        <h2 className="font-display text-3xl italic text-paper">{s.name}</h2>
                        <p className="font-type text-sm text-muted">{s.role} · {s.department}</p>
                      </div>
                      {exhibits(s)}
                    </motion.section>
                  ))}
                </div>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0.85, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 140, damping: 16 }}
                >
                  <Portrait suspect={accused[0]} size={compact ? (phone ? 110 : 140) : phone ? 170 : 230} highlight />
                </motion.div>
                <p className={cn("font-type text-[11px] tracking-[0.45em] text-red", compact ? "mt-3" : "mt-6")}>THE ACCUSED</p>
                <h2 className="font-display text-4xl italic text-paper sm:text-5xl">{accused[0].name}</h2>
                <p className="font-type text-sm text-muted">{accused[0].role} · {accused[0].department}</p>
                {!compact && (
                  <p className="mt-5 h-6 font-type text-base italic text-paper/85 sm:text-lg">
                    “<Typewriter text={lineFor(accused[0])} delay={700} speed={40} cursor={false} />”
                  </p>
                )}
                <div className="mt-6 w-full max-w-xl">
                  {required === 0 && (
                    <p className="mb-3 text-sm text-amber">No clues to file — your budget is spent. Accusing on instinct alone.</p>
                  )}
                  {exhibits(accused[0])}
                </div>
              </>
            )}

            <div className={cn("flex flex-col items-center gap-4", compact ? "mt-5" : "mt-8")}>
              <HoldToConfirm
                label={pending ? "…" : "HOLD"}
                sublabel={pending ? "FILING" : "TO ACCUSE"}
                disabled={pending || !ready}
                onConfirm={confirm}
              />
              <p className="font-type text-[11px] tracking-[0.3em] text-muted">ONE SHOT · NO TAKE-BACKS</p>
              {error && (
                <p role="alert" className="max-w-sm rounded-sm border border-red/60 bg-ink-900 px-3 py-2 font-type text-sm text-[#ffd9da]">
                  {error}
                </p>
              )}
              <button
                onClick={onCancel}
                disabled={pending}
                className="font-type text-xs tracking-[0.3em] text-paper/60 underline-offset-4 hover:text-paper hover:underline"
              >
                NOT YET (ESC)
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
