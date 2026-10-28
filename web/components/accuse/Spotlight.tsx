"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Portrait } from "@/components/case/Portrait";
import { Typewriter } from "@/components/fx/Typewriter";
import { useAccused } from "@/lib/accused";
import { ApiError, accuse } from "@/lib/api";
import { browserStorage, loadProgress, recordResult, saveProgress } from "@/lib/progress";
import { sfx } from "@/lib/sound";
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
export function Spotlight({ caseId, suspect, evidence, onCancel, onAccused }: {
  caseId: string;
  suspect: Suspect | null;
  evidence: ToolResult[];
  onCancel: () => void;
  onAccused: () => void;
}) {
  const router = useRouter();
  const reduced = useReducedEffects();
  const phone = useMediaQuery("(max-width: 639px)") ?? false;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const verdict = await accuse(caseId, suspect.id, evidence.map((r) => r.result_id));
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

          <div className="relative flex min-h-full flex-col items-center px-4 pb-10 pt-[8vh] text-center">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 140, damping: 16 }}
            >
              <Portrait suspect={suspect} size={phone ? 170 : 230} highlight />
            </motion.div>
            <p className="mt-6 font-type text-[11px] tracking-[0.45em] text-red">THE ACCUSED</p>
            <h2 className="font-display text-4xl italic text-paper sm:text-5xl">{suspect.name}</h2>
            <p className="font-type text-sm text-muted">{suspect.role} · {suspect.department}</p>
            <p className="mt-5 h-6 font-type text-base italic text-paper/85 sm:text-lg">
              “<Typewriter text={line} delay={700} speed={40} cursor={false} />”
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {evidence.map((r, i) => (
                <span key={r.result_id} className="rounded-sm border border-line bg-ink-900/90 px-3 py-1.5 font-mono text-[11px] text-paper">
                  <span className="mr-1.5 text-amber">EXHIBIT {String.fromCharCode(65 + i)}</span>
                  <span className="mr-1 font-display font-bold italic">{toolMeta(r.tool_id).icon}</span>
                  {r.title}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4">
              <HoldToConfirm
                label={pending ? "…" : "HOLD"}
                sublabel={pending ? "FILING" : "TO ACCUSE"}
                disabled={pending}
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
