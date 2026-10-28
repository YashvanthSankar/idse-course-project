"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Portrait } from "@/components/case/Portrait";
import { Typewriter } from "@/components/fx/Typewriter";
import { clueWarning, defaultPick } from "@/lib/accusation";
import { useAccused } from "@/lib/accused";
import { ApiError, accuse } from "@/lib/api";
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

/** The interrogation-room moment: one suspect, one lamp, one irreversible decision. */
export function Spotlight({ caseId, suspect, evidence, required = 2, onCancel, onAccused }: {
  caseId: string;
  suspect: Suspect | null;
  evidence: ToolResult[];
  /** how many clues must be filed (2, or fewer when the budget is spent) */
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
  // Which clues get filed. Re-picked whenever the accused or their clues change.
  const pickKey = `${suspect?.id}:${evidence.map((r) => r.result_id).join(",")}:${required}`;
  const [picked, setPicked] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const chosen = picked.key === pickKey ? picked.ids : suspect ? defaultPick(evidence, suspect.id, required) : [];
  const choosing = evidence.length > required;
  // Choosing clues adds a list: shrink the portrait so the hold button stays on screen
  const compact = choosing && (short || phone);
  const toggle = (id: string) => {
    sfx.play("tick");
    const next = chosen.includes(id)
      ? chosen.filter((x) => x !== id)
      : [...chosen, id].slice(-required); // picking a third drops the oldest pick
    setPicked({ key: pickKey, ids: next });
  };
  const suspects = useCaseStore((s) => s.meta?.suspects ?? []);
  const nameOf = (id: string) => suspects.find((x) => x.id === id)?.name.split(" ")[0] ?? id;

  useEffect(() => {
    if (!suspect) return;
    sfx.loop("heartbeat");
    return () => sfx.stop("heartbeat");
  }, [suspect]);

  useEffect(() => {
    if (!suspect || pending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suspect, pending, onCancel]);

  const confirm = async () => {
    if (!suspect) return;
    setPending(true);
    setError(null);
    try {
      const verdict = await accuse(caseId, suspect.id, chosen);
      const store = useCaseStore.getState();
      store.setVerdict(verdict);
      useAccused.getState().set(caseId, suspect.id);
      const level = store.meta?.level ?? 1;
      const storage = browserStorage();
      saveProgress(storage, recordResult(loadProgress(storage), level, verdict.correct, verdict.score));
      sfx.stop("heartbeat");
      onAccused();
      router.push(`/case/${caseId}/verdict`);
    } catch (err) {
      setPending(false);
      sfx.play("buzz");
      setError(err instanceof ApiError ? err.detail : "The line went dead. Try again.");
    }
  };

  const line = suspect ? LINES[suspect.id.charCodeAt(suspect.id.length - 1) % LINES.length] : "";

  return (
    <AnimatePresence>
      {suspect && (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={`Accuse ${suspect.name}`}
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
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 140, damping: 16 }}
            >
              <Portrait suspect={suspect} size={compact ? (phone ? 110 : 140) : phone ? 170 : 230} highlight />
            </motion.div>
            <p className={cn("font-type text-[11px] tracking-[0.45em] text-red", compact ? "mt-3" : "mt-6")}>THE ACCUSED</p>
            <h2 className="font-display text-4xl italic text-paper sm:text-5xl">{suspect.name}</h2>
            <p className="font-type text-sm text-muted">{suspect.role} · {suspect.department}</p>
            {!compact && (
              <p className={cn("h-6 font-type text-base italic text-paper/85 sm:text-lg", compact ? "mt-2" : "mt-5")}>
                “<Typewriter text={line} delay={700} speed={40} cursor={false} />”
              </p>
            )}

            <div className="mt-6 w-full max-w-xl">
              {choosing && (
                <p className="mb-3 text-sm text-paper/80">
                  You tied {evidence.length} clues to {suspect.name.split(" ")[0]}. Choose the {required} you&apos;ll file.
                </p>
              )}
              {required === 0 && (
                <p className="mb-3 text-sm text-amber">No clues to file — your budget is spent. Accusing on instinct alone.</p>
              )}
              <ul className="flex flex-wrap justify-center gap-2" data-testid="exhibits">
                {evidence.map((r) => {
                  const on = chosen.includes(r.result_id);
                  const warn = clueWarning(r, suspect.id, nameOf);
                  const body = (
                    <>
                      <span className="block font-mono text-[12px] text-paper">
                        <span className="mr-1.5 font-display font-bold not-italic">{toolMeta(r.tool_id).icon}</span>
                        {r.title}
                      </span>
                      {warn && (
                        <span className={cn("mt-0.5 block text-xs", warn.tone === "bad" ? "text-red" : "text-amber")}>
                          {warn.text}
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
                          onClick={() => toggle(r.result_id)}
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

            <div className={cn("flex flex-col items-center gap-4", compact ? "mt-5" : "mt-8")}>
              <HoldToConfirm
                label={pending ? "…" : "HOLD"}
                sublabel={pending ? "FILING" : "TO ACCUSE"}
                disabled={pending || chosen.length !== required}
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
