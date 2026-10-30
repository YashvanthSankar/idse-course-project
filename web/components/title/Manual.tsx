"use client";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, TOOL_KIT } from "@/lib/proof";
import { toolMeta } from "@/lib/toolMeta";

const STEPS = [
  ["Read the briefing", "The Chief hints at what smells wrong. Every case has five suspects — one is cooking the books."],
  ["Investigate", "Run detective tools on the ledger. Each one is real Python analysis and costs budget. Re-running the same tool is free."],
  ["Pin evidence", "Pin results that point at someone. On the corkboard, drag them onto a suspect — red string ties the case together."],
  ["Accuse", "Quick Case: choose one suspect and attach two pieces of evidence (if your budget runs out first, you file what you have). Career Mode: name the trick, attach one or two clues, and pin the rows that show it. One shot. No take-backs."],
  ["Verdict", "Quick Case: right suspect = 1000 points, strong evidence +250 each, every coin you didn't spend +40. Career Mode: a rating out of 100 (below). There's no clock — the budget is the challenge: you can't run every tool, so pick the analysis that fits the clue."],
];

// From the calibration runs: 544 career cases, every tool and setting (docs/CAREER.md §3.1)
const PROOF_GROUPS = [
  {
    title: "Proves it on its own",
    tools: "Twin Finder · Benford's Law · Margin Model · Box & Whisker · Pattern Matrix by vendor",
    note: "When it names one person, they did it: 97–100% of the time.",
  },
  {
    title: "Nearly sure — back it up when you can",
    tools: "Anomaly Hunter · Timeline · Pattern Matrix by weekday",
    note: "Right 94–98% of the time. Still counts as proof when it fits the trick.",
  },
  {
    title: "Screens only — never proof",
    tools: "Z-Score Scan · Pattern Matrix by category or hour · Case Summary",
    note: "Says who's unusual, not who's guilty. Z-Score was wrong about half the time it named one person.",
  },
];

const CAREER_POINTS = [
  ["Verdict", "35", "the right person"],
  ["Theory", "10", "the right trick"],
  ["Proof", "10", "a clue that fits your theory, or two tools that agree"],
  ["Exhibits", "25", "the rows that show it — and only those (both halves of a twin pair count)"],
  ["Spending", "20", "coins past what the case needed (a cross-check is free at small firms); only when a clue points at who you accused"],
];

export function Manual({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Detective's Manual" className="max-w-2xl">
      <div className="tex-paper relative rounded-sm p-6 shadow-2xl sm:p-10">
        {/* phones have no Esc and no backdrop to tap: a close button you can see from the top */}
        <button onClick={onClose} aria-label="Close the manual" className="absolute right-2 top-2 flex size-11 items-center justify-center text-2xl opacity-60 hover:opacity-100">
          ✕
        </button>
        <p className="pr-10 font-type text-xs tracking-[0.3em] opacity-60">CONFIDENTIAL · FOR NEW RECRUITS</p>
        <h2 className="mb-6 mt-1 font-display text-4xl italic">The Detective&apos;s Manual</h2>
        <ol className="space-y-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="font-display text-3xl italic text-red">{i + 1}</span>
              <div>
                <h3 className="font-type text-lg">{title}</h3>
                <p className="text-[15px] leading-relaxed opacity-85">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h3 className="mb-3 mt-8 font-type text-lg">The Tool Kit</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TOOL_KIT.map((t) => (
            <div key={t.tool} className="rounded border border-black/15 bg-black/5 p-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{toolMeta(t.tool).icon}</span>
                <span className="font-semibold">{t.name}</span>
                <span className={cn("ml-auto rounded-sm border px-1.5 text-[10px] mix-blend-multiply",
                  t.role === "proves" ? "border-[#1f6b3a] text-[#1f6b3a]" : "border-[#9a6a00] text-[#9a6a00]")}>
                  {ROLE_LABEL[t.role]}
                </span>
              </div>
              <div className="mt-0.5 text-[13px] opacity-75">{t.what}</div>
            </div>
          ))}
        </div>

        <h3 className="mb-3 mt-8 font-type text-lg">Which tests prove what</h3>
        <ul className="space-y-3" data-testid="manual-proof">
          {PROOF_GROUPS.map((g) => (
            <li key={g.title} className="rounded border border-black/15 p-3 text-sm">
              <p className="font-semibold">{g.title}</p>
              <p className="mt-0.5">{g.tools}</p>
              <p className="mt-0.5 text-[13px] opacity-75">{g.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] opacity-75">
          A test that fits one trick tells you nothing about another: Twin Finder can&apos;t see a weekend payment. Name the
          trick first, then pick the test that checks it.
        </p>

        <h3 className="mb-3 mt-8 font-type text-lg">Career Mode: the rating</h3>
        <table className="w-full text-sm">
          <tbody>
            {CAREER_POINTS.map(([part, points, what]) => (
              <tr key={part} className="border-b border-black/10">
                <td className="py-1 pr-3 font-semibold">{part}</td>
                <td className="py-1 pr-3 tabular-nums">{points}</td>
                <td className="py-1 opacity-80">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[13px] opacity-75">
          A contract is the average of its cases. Exceptional takes 88 at small and mid firms, 92 at large ones and 90 at
          the very large — and the hard case solved. At a large firm, three Good years count as one Exceptional.
        </p>

        <p className="mt-6 font-type text-sm opacity-70">
          Remember, rookie: an outlier is a question, not an answer. The CEO spends big. Diwali bonuses are
          large. Neither is a crime.
        </p>
        <button onClick={onClose} className="mt-6 min-h-11 font-type tracking-widest text-red underline">
          CLOSE THE MANUAL
        </button>
      </div>
    </Modal>
  );
}
