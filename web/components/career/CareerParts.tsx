"use client";
import { motion } from "framer-motion";
import { Portrait } from "@/components/case/Portrait";
import { Typewriter } from "@/components/fx/Typewriter";
import { Modal } from "@/components/ui/Modal";
import { BAND_LABEL, BAND_STYLE, TIER_TOOLS, formatSalary } from "@/lib/career";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, TOOL_KIT } from "@/lib/proof";
import { sfx } from "@/lib/sound";
import { toolMeta } from "@/lib/toolMeta";
import type { Appraisal, CompanyCard, Greeting, SeniorNotes } from "@/lib/types";

const TIER_STYLE: Record<string, string> = {
  small: "border-paper/40 text-paper/70",
  mid: "border-cyan/60 text-cyan",
  large: "border-amber/70 text-amber",
  very_large: "border-red/70 text-red",
  final: "border-[#ffd319] text-[#ffd319]",
};

export function TierChip({ tier, name }: { tier: string; name: string }) {
  return (
    <span className={cn("rounded-sm border px-2 py-0.5 font-pixel text-[9px] uppercase", TIER_STYLE[tier])}>{name}</span>
  );
}

/** An offer letter on the desk. */
export function OfferLetter({ company, index, onSign, signing, practice = false }: {
  company: CompanyCard;
  index: number;
  onSign: () => void;
  signing: boolean;
  practice?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24, rotate: index % 2 ? 1.5 : -1.5 }}
      animate={{ opacity: 1, y: 0, rotate: index % 2 ? 0.6 : -0.6 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 140, damping: 16 }}
      data-testid="offer"
      data-company={company.id}
      className="tex-paper flex flex-col rounded-[2px] p-5 text-ink-950 shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-double border-black/30 pb-2">
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-bold italic leading-tight">{company.name}</h3>
          <p className="font-type text-[12px] opacity-70">{company.city} · {company.industry}</p>
        </div>
        <TierChip tier={company.tier} name={company.tier_name} />
      </div>
      <p className="mt-3 flex-1 font-type text-[14px] leading-relaxed">{company.letter}</p>
      <p className="mt-3 font-type text-[12px] italic opacity-75">Culture: {company.culture_note}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-type text-[12px] opacity-75">
          {company.cases} cases{practice ? " · practice, no raise" : ` · base ${formatSalary(company.base_salary)}`}
        </p>
        <button
          onClick={() => {
            sfx.play("stamp");
            onSign();
          }}
          disabled={signing}
          className="min-h-11 bg-[#8f1d27] px-5 py-2 font-type text-sm tracking-[0.2em] text-paper shadow-[3px_3px_0_#000] hover:bg-[#a3121f] disabled:opacity-60"
        >
          {signing ? "SIGNING…" : practice ? "REPLAY" : "SIGN"}
        </button>
      </div>
    </motion.article>
  );
}

/** First day at a new company: your old colleagues come over to say hello. */
export function GreetingsModal({ open, greetings, company, onClose }: {
  open: boolean;
  greetings: Greeting[];
  company: string;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} label="Familiar faces" className="max-w-3xl">
      <div className="rounded-sm border border-line bg-ink-900/95 p-5 sm:p-8" data-testid="greetings">
        <p className="font-type text-[11px] tracking-[0.4em] text-amber/80">FIRST DAY AT {company.toUpperCase()}</p>
        <h2 className="mt-1 font-display text-3xl italic text-paper">
          {greetings.some((g) => g.last_company) ? "A familiar face" : "Your new colleagues"}
          {greetings.length > 1 && greetings.some((g) => g.last_company) ? "s" : ""}
        </h2>
        <ul className="mt-6 flex flex-col gap-6">
          {greetings.map((g, i) => (
            <li key={g.cameo} className="flex items-start gap-4">
              <div className="w-[88px] shrink-0"><Portrait suspect={{ name: g.name, role: g.role, portrait: g.portrait }} size={88} caption={false} /></div>
              <div className="min-w-0">
                <p className="font-display text-xl italic text-paper">{g.name}</p>
                <p className="text-xs uppercase tracking-widest text-muted">{g.role}</p>
                <p className="mt-2 font-type text-[15px] leading-relaxed text-paper/90">
                  “<Typewriter text={g.line} speed={18} delay={i * 900} cursor={false} />”
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex justify-end">
          <button onClick={onClose} className="min-h-11 bg-[#ffd319] px-6 py-3 font-pixel text-xs text-[#05060d] shadow-[4px_4px_0_#ff2a6d]">
            GET TO WORK ▶
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** A senior at the company hands over their notes (CAREER.md §7.7): how honest money moves here,
 *  what fooled the last auditor — and, at small and mid firms, what each tool can prove. */
export function NotesModal({ open, notes, company, onClose }: {
  open: boolean;
  notes: SeniorNotes | null;
  company: CompanyCard | null;
  onClose: () => void;
}) {
  const kit = TOOL_KIT.filter((t) => company && TIER_TOOLS[company.tier]?.includes(t.tool));
  return (
    <Modal open={open && notes !== null} onClose={onClose} label="Notes from your senior" className="max-w-2xl">
      {notes && company && (
        <div className="tex-paper rounded-[2px] p-6 text-ink-950 shadow-2xl sm:p-9" data-testid="senior-notes">
          <div className="flex items-start gap-4 border-b-2 border-double border-black/30 pb-3">
            <div className="w-[72px] shrink-0">
              <Portrait suspect={{ name: notes.name, role: notes.role, portrait: notes.portrait }} size={72} caption={false} />
            </div>
            <div className="min-w-0">
              <p className="font-type text-[11px] tracking-[0.35em] opacity-60">NOTES ON {company.name.toUpperCase()}</p>
              <h2 className="font-display text-2xl font-bold italic leading-tight">{notes.name}</h2>
              <p className="font-type text-[12px] opacity-70">{notes.role}</p>
              <p className="mt-1 font-type text-[14px] italic">“{notes.hello}”</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3 font-type text-[15px] leading-relaxed">
            {notes.notes.map((line) => (
              <li key={line}>— {line}</li>
            ))}
          </ul>
          {notes.kit && (
            <section className="mt-5">
              <h3 className="font-type text-[11px] tracking-[0.35em] opacity-60">YOUR KIT THIS YEAR</h3>
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {kit.map((t) => (
                  <li key={t.tool} className="flex items-baseline gap-2">
                    <span className="w-5 shrink-0 text-center font-mono font-bold">{toolMeta(t.tool).icon}</span>
                    <span className="w-32 shrink-0 font-semibold">{t.name}</span>
                    <span className={cn("shrink-0 rounded-sm border px-1.5 text-[10px] mix-blend-multiply", t.role === "proves" ? "border-[#1f6b3a] text-[#1f6b3a]" : "border-[#9a6a00] text-[#9a6a00]")}>
                      {ROLE_LABEL[t.role]}
                    </span>
                    <span className="opacity-80">{t.what}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {notes.proof_rule && (
            <section className="mt-5 rounded-sm border border-black/20 bg-black/5 p-3 text-[13px]">
              <h3 className="font-type text-[11px] tracking-[0.35em] opacity-60">WHAT PROVES A CASE</h3>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                <li>Name the trick you think they used.</li>
                <li>Attach a clue from a tool that PROVES that trick, or two different tools that agree.</li>
                <li>Pin the rows from their ledger that show it. Honest rows count against you.</li>
              </ol>
            </section>
          )}
          <div className="mt-7 flex justify-end">
            <button onClick={onClose} className="min-h-11 bg-[#8f1d27] px-6 py-2 font-type tracking-[0.2em] text-paper hover:bg-[#a3121f]">
              GOT IT
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** The end-of-year appraisal: the rating, the raise, what changed. */
export function AppraisalModal({ appraisal, onClose }: { appraisal: Appraisal | null; onClose: () => void }) {
  return (
    <Modal open={appraisal !== null} onClose={onClose} label="Appraisal" className="max-w-xl">
      {appraisal && (
        <div className="tex-paper relative rounded-[2px] p-6 text-ink-950 shadow-2xl sm:p-9" data-testid="appraisal">
          <p className="font-type text-[11px] tracking-[0.35em] opacity-60">
            YEAR {appraisal.year} · {appraisal.practice ? "PRACTICE" : "ANNUAL APPRAISAL"}
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold italic">{appraisal.company}</h2>
          <motion.p
            initial={{ scale: 2.2, opacity: 0, rotate: -14 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 14 }}
            onAnimationComplete={() => sfx.play("stamp")}
            data-testid="appraisal-band"
            className={cn("absolute right-5 top-6 rounded border-[3px] px-3 py-1 font-type text-lg tracking-[0.25em] mix-blend-multiply",
              appraisal.band === "bad" ? "border-[#a3121f] text-[#a3121f]" : appraisal.band === "exceptional" ? "border-[#9a6a00] text-[#9a6a00]" : "border-[#1f6b3a] text-[#1f6b3a]")}
          >
            {BAND_LABEL[appraisal.band].toUpperCase()}
          </motion.p>
          <p className="mt-4 font-type text-sm">
            Case ratings: {appraisal.ratings.map((r) => Math.round(r)).join(" · ")} — average{" "}
            <span className="font-bold">{appraisal.average}</span>
          </p>
          {!appraisal.practice && (
            <p className="mt-2 font-type text-sm">
              Salary: {formatSalary(appraisal.salary_before)} →{" "}
              <span className="font-bold">{formatSalary(appraisal.salary_after)}</span>
              {appraisal.salary_after > appraisal.salary_before &&
                ` (+${Math.round((appraisal.salary_after / appraisal.salary_before - 1) * 100)}%)`}
            </p>
          )}
          <ul className="mt-4 space-y-2 font-type text-[15px] leading-relaxed">
            {appraisal.events.map((e) => (
              <li key={e}>— {e}</li>
            ))}
          </ul>
          {appraisal.new_offers.length > 0 && (
            <p className="mt-4 font-type text-sm font-bold">
              {appraisal.new_offers.length} new offer{appraisal.new_offers.length === 1 ? "" : "s"} on your desk.
            </p>
          )}
          <div className="mt-7 flex justify-end">
            <button onClick={onClose} className="min-h-11 bg-[#8f1d27] px-6 py-2 font-type tracking-[0.2em] text-paper hover:bg-[#a3121f]">
              BACK TO THE DESK
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function History({ history }: { history: Appraisal[] }) {
  if (history.length === 0) return null;
  return (
    <section aria-label="Your career so far" className="mt-12">
      <h2 className="mb-3 font-type text-xs tracking-[0.45em] text-paper/70">YOUR CAREER SO FAR</h2>
      <ol className="divide-y divide-line/60 rounded-sm border border-line bg-ink-900/70">
        {history.map((a, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className="w-16 font-pixel text-[10px] text-paper/50">YEAR {a.year}</span>
            <span className="min-w-0 flex-1 font-display text-lg italic text-paper">{a.company}{a.practice ? " · practice" : ""}</span>
            <span className="tabular-nums text-paper/70">{a.average}</span>
            <span className={cn("rounded-sm border px-2 py-0.5 text-xs", BAND_STYLE[a.band])}>{BAND_LABEL[a.band]}</span>
            {!a.practice && <span className="w-24 text-right text-sm tabular-nums text-paper/70">{formatSalary(a.salary_after)}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
