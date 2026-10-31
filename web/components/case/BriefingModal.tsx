"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Typewriter } from "@/components/fx/Typewriter";
import { Modal } from "@/components/ui/Modal";
import { getPlayerSnapshot, subscribePlayer } from "@/lib/player";
import { totalScore } from "@/lib/progress";
import { rankFor } from "@/lib/rank";
import { sfx } from "@/lib/sound";
import type { CaseMeta } from "@/lib/types";
import { useProgress } from "@/lib/useProgress";
import { useReducedEffects } from "@/lib/useReducedEffects";
import { DIFFICULTY_LABEL } from "@/lib/career";
import { Portrait } from "./Portrait";

/** The Chief's memo plus the suspect line-up, shown before a case opens. */
export function BriefingModal({ meta, onClose, onOpenFiles, closeLabel = "BACK TO THE DESK" }: {
  meta: CaseMeta | null;
  onClose: () => void;
  onOpenFiles: (meta: CaseMeta) => void;
  closeLabel?: string;
}) {
  const reduced = useReducedEffects();
  const router = useRouter();
  // Load the case page while the player reads the briefing, so OPEN THE FILES opens it at once
  // instead of waiting on a server round trip after the click.
  const caseId = meta?.case_id;
  useEffect(() => {
    if (caseId) router.prefetch(`/case/${caseId}`);
  }, [router, caseId]);
  const [typedFor, setTypedFor] = useState<string | null>(null);
  const typed = reduced || (meta !== null && typedFor === meta.case_id);
  const career = meta?.career ?? null;
  // Addressed to you: your Quick Case rank (the same one the top bar shows) and your name
  const rank = rankFor(totalScore(useProgress())).title;
  const stored = useSyncExternalStore(subscribePlayer, getPlayerSnapshot, () => "");
  const name = stored ? ((JSON.parse(stored) as { name?: string }).name ?? "") : "";
  const to = career ? (name ? `${name}, Forensic Auditor` : "Forensic Auditor") : name ? `${rank} ${name}` : `${rank} Auditor`;
  const caseNo = career ? `${career.index} of ${career.total}` : meta ? String(meta.level).padStart(2, "0") : "";

  return (
    <Modal open={meta !== null} onClose={onClose} label="Case briefing" className="max-w-5xl">
      {meta && (
        <div className="relative">
          {/* The memo */}
          <motion.article
            initial={reduced ? false : { rotate: -2, y: 20 }}
            animate={{ rotate: -0.6, y: 0 }}
            className="tex-paper relative mx-auto max-w-3xl rounded-[2px] px-5 py-6 shadow-[0_25px_50px_rgba(0,0,0,0.7)] sm:px-10 sm:py-8"
          >
            <div className="flex items-start justify-between gap-4 border-b-2 border-double border-black/40 pb-3">
              <div>
                <p className="font-type text-[10px] tracking-[0.35em] opacity-70 sm:text-xs">
                  BUREAU OF FORENSIC AUDIT · MUMBAI
                </p>
                <h2 className="font-display text-2xl font-bold italic sm:text-3xl">Internal Memorandum</h2>
              </div>
              <div className="shrink-0 rotate-[8deg] rounded border-[3px] border-[#a3121f]/80 px-2 py-0.5 font-type text-xs tracking-[0.3em] text-[#a3121f]/85 mix-blend-multiply sm:text-sm">
                CONFIDENTIAL
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 font-type text-[13px] sm:text-sm">
              <dt className="opacity-60">TO:</dt>
              <dd data-testid="memo-to">{to}</dd>
              <dt className="opacity-60">FROM:</dt>
              <dd>R. Desai, Chief Auditor</dd>
              <dt className="opacity-60">RE:</dt>
              <dd className="font-bold">
                {career ? `${career.company} — Case ${caseNo} · ${DIFFICULTY_LABEL[career.difficulty]}` : `Case No. ${caseNo} — ${meta.title}`}
              </dd>
            </dl>
            <p className="mt-4 min-h-24 whitespace-pre-line font-type text-[15px] leading-relaxed sm:text-base">
              <Typewriter key={meta.case_id} text={meta.briefing} speed={22} onDone={() => setTypedFor(meta.case_id)} />
            </p>
            <p className="mt-4 font-type text-[13px] opacity-75">
              Ledger: {meta.n_rows.toLocaleString("en-IN")} transactions · Investigation budget:{" "}
              <span className="font-bold">{meta.budget} coins</span>
            </p>
            {career && career.culprits > 1 && (
              <p data-testid="two-culprits" className="mt-2 font-type text-[13px] font-bold text-[#8f1d27]">
                Two fraudsters in this ledger. Accuse both, with a clue that fits each one&apos;s trick.
              </p>
            )}
            <p className="mt-1 font-type text-[13px] opacity-75">
              {career
                ? "A free Case Summary is already on file. Not enough coins to run every tool — your rating rewards the right tool, not every tool. No clock: take your time."
                : "Not enough to run every tool. Think before you spend — each coin you save is worth 40 points. No clock: take your time."}
            </p>
            <p className="mt-2 text-right font-display text-xl italic">— R.D.</p>
          </motion.article>

          {/* The suspects */}
          <section aria-label="Suspects" className="mt-6">
            <h3 className="mb-3 text-center font-type text-xs tracking-[0.45em] text-paper/80">THE SUSPECTS</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              {meta.suspects.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={reduced ? false : { opacity: 0, y: 40, rotate: (i % 2 ? 1 : -1) * 10 }}
                  animate={{ opacity: 1, y: 0, rotate: (i % 2 ? 1 : -1) * (1.5 + (i % 3)) }}
                  transition={{ type: "spring", stiffness: 200, damping: 18, delay: reduced ? 0 : 0.5 + i * 0.15 }}
                  onAnimationStart={() => !reduced && i === 0 && sfx.play("whoosh")}
                  className="flex flex-col items-center"
                >
                  <div className="relative">
                    <div aria-hidden className="absolute -top-2 left-1/2 z-10 h-4 w-12 -translate-x-1/2 rotate-[-4deg] bg-[#e8dfc6]/70 shadow-sm" />
                    <Portrait suspect={s} size={124} />
                  </div>
                  <div className="mt-2 max-w-[150px] text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-amber">{s.role}</p>
                    <p className="text-[11px] text-muted">{s.department}</p>
                    <p className="mt-1 font-type text-[12px] leading-snug text-paper/85">{s.bio}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col-reverse items-center justify-center gap-3 bg-[linear-gradient(to_top,#000_55%,transparent)] px-4 pb-4 pt-8 sm:flex-row sm:gap-6">
            <button onClick={onClose} className="min-h-11 font-pixel text-[10px] text-paper/70 hover:text-paper sm:text-xs">
              {closeLabel}
            </button>
            <motion.button
              onClick={() => {
                sfx.play("stamp");
                onOpenFiles(meta);
              }}
              animate={typed && !reduced ? { scale: [1, 1.04, 1] } : undefined}
              transition={{ duration: 1.6, repeat: 2 }} // a nudge, not a button that never sits still
              className="bg-[#ffd319] px-7 py-3.5 font-pixel text-xs text-[#05060d] shadow-[4px_4px_0_#ff2a6d] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none sm:text-sm"
            >
              OPEN THE FILES
            </motion.button>
          </div>
        </div>
      )}
    </Modal>
  );
}
