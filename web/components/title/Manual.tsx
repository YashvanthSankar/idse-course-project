"use client";
import { Modal } from "@/components/ui/Modal";

const STEPS = [
  ["Read the briefing", "The Chief hints at what smells wrong. Every case has five suspects — one is cooking the books."],
  ["Investigate", "Run detective tools on the ledger. Each one is real Python analysis and costs budget. Re-running the same tool is free."],
  ["Pin evidence", "Pin results that point at someone. On the corkboard, drag them onto a suspect — red string ties the case together."],
  ["Accuse", "Choose one suspect and attach exactly two pieces of evidence. One shot. No take-backs."],
  ["Verdict", "Right suspect = 1000 points. Strong evidence +250 each, leftover budget and speed add bonuses. Irrelevant evidence costs you."],
];

const TOOLS = [
  ["Σ", "Case Summary", "describe() per employee"],
  ["▦", "Pattern Matrix", "crosstab + chi-square"],
  ["z", "Z-Score Scan", "outliers in log-amounts"],
  ["▢", "Box & Whisker", "IQR fences"],
  ["⧉", "Twin Finder", "duplicate invoices"],
  ["1", "Benford's Law", "first-digit test"],
  ["⌁", "Timeline", "weekend spending"],
  ["╱", "Margin Model", "linear regression residuals"],
  ["◎", "Anomaly Hunter", "IsolationForest (ML)"],
];

export function Manual({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="Detective's Manual" className="max-w-2xl">
      <div className="tex-paper rounded-sm p-6 shadow-2xl sm:p-10">
        <p className="font-type text-xs tracking-[0.3em] opacity-60">CONFIDENTIAL · FOR NEW RECRUITS</p>
        <h2 className="mb-6 mt-1 font-display text-4xl italic">The Detective&apos;s Manual</h2>
        <ol className="space-y-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="font-display text-3xl italic text-red">{i + 1}</span>
              <div>
                <h3 className="font-type text-lg">{title}</h3>
                <p className="text-sm opacity-80">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <h3 className="mb-3 mt-8 font-type text-lg">The Tool Kit</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TOOLS.map(([icon, name, what]) => (
            <div key={name} className="rounded border border-black/15 bg-black/5 p-2 text-sm">
              <span className="mr-2 font-mono font-bold">{icon}</span>
              <span className="font-semibold">{name}</span>
              <div className="text-xs opacity-70">{what}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 font-type text-sm opacity-70">
          Remember, rookie: an outlier is a question, not an answer. The CEO spends big. Diwali bonuses are
          large. Neither is a crime.
        </p>
        <button onClick={onClose} className="mt-6 font-type tracking-widest text-red underline">
          CLOSE THE MANUAL
        </button>
      </div>
    </Modal>
  );
}
