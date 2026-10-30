"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { suspectRows, type LedgerRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fits, proofOf, roleOf, ROLE_LABEL, ROLE_STYLE, settingOf } from "@/lib/proof";
import { sfx } from "@/lib/sound";
import { toolMeta } from "@/lib/toolMeta";
import type { SchemeId, Suspect, Theory, ToolResult } from "@/lib/types";

export const MAX_CLUES = 2;
export const MAX_EXHIBITS = 5;

export type Charge = { theory: SchemeId | null; clues: string[]; exhibits: string[] };

export const chargeReady = (c: Charge) =>
  c.theory !== null && c.clues.length >= 1 && c.clues.length <= MAX_CLUES && c.exhibits.length >= 1;

const PROOF_TEXT = {
  proven: { tone: "text-green border-green/60", label: "PROVEN", text: "A clue that fits your theory singles them out." },
  lead: {
    tone: "text-amber border-amber/60",
    label: "ONLY A LEAD",
    text: "Nothing here fits your theory. Add a clue from a tool that does, or a second tool that agrees.",
  },
  none: { tone: "text-red border-red/60", label: "NO PROOF", text: "None of these clues points at them." },
} as const;

/** Career Mode's accusation, for one accused (CAREER.md §3.1): the trick you think they used,
 *  one or two clues, and the rows from their own ledger that show it. */
export function CaseFile({ caseId, suspect, evidence, theories, culprits = 1, theoriesFailed = false, charge, onChange, disabled }: {
  caseId: string;
  suspect: Suspect;
  evidence: ToolResult[];
  theories: Theory[];
  /** fraudsters in this case: with two, one result may name both */
  culprits?: number;
  /** the list of tricks didn't load (a server too old or too far away) */
  theoriesFailed?: boolean;
  charge: Charge;
  onChange: (next: Charge) => void;
  disabled: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const first = suspect.name.split(" ")[0];
  const theory = theories.find((t) => t.id === charge.theory) ?? null;
  const clues = evidence.filter((r) => charge.clues.includes(r.result_id));
  const proof = PROOF_TEXT[proofOf(suspect.id, theory, clues, culprits)];
  // The proof meter appears under the sticky hold bar on short screens: bring it into view
  // when the theory or the clues change (not on the first render)
  const meter = useRef<HTMLParagraphElement>(null);
  const seen = useRef(`${charge.theory}|${charge.clues.length}`);
  useEffect(() => {
    const now = `${charge.theory}|${charge.clues.length}`;
    if (now === seen.current) return;
    seen.current = now;
    meter.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [charge.theory, charge.clues.length]);

  const toggleClue = (id: string) => {
    sfx.play("tick");
    const next = charge.clues.includes(id) ? charge.clues.filter((x) => x !== id) : [...charge.clues, id].slice(-MAX_CLUES);
    onChange({ ...charge, clues: next });
  };

  return (
    <div className="w-full space-y-4 text-left" data-testid="case-file">
      <section>
        <h3 className="font-type text-[11px] tracking-[0.35em] text-paper/60">1 · THE TRICK</h3>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`How ${first} did it`}>
          {theoriesFailed && (
            <p className="text-sm text-red" role="alert">The list of tricks didn&apos;t load. Close this and try again in a moment.</p>
          )}
          {theories.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={charge.theory === t.id}
              disabled={disabled}
              onClick={() => {
                sfx.play("tick");
                onChange({ ...charge, theory: t.id });
              }}
              className={cn(
                "min-h-10 rounded-sm border px-3 py-1.5 text-sm transition-colors",
                charge.theory === t.id ? "border-amber bg-amber/15 text-amber" : "border-line bg-ink-900/90 text-paper/80 hover:text-paper",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-type text-[11px] tracking-[0.35em] text-paper/60">2 · THE CLUE (ONE OR TWO)</h3>
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="exhibits">
          {evidence.map((r) => {
            const on = charge.clues.includes(r.result_id);
            const role = roleOf(r.tool_id, settingOf(r));
            const pointsAt = r.implicates.includes(suspect.id);
            return (
              <li key={r.result_id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggleClue(r.result_id)}
                  className={cn(
                    "min-h-11 rounded-sm border px-3 py-2 text-left transition-colors",
                    on ? "border-amber bg-amber/15" : "border-line bg-ink-900/90 opacity-75 hover:opacity-100",
                  )}
                >
                  <span className="mr-2 text-amber">{on ? "☑" : "☐"}</span>
                  <span className="font-mono text-[12px] text-paper">
                    <span className="mr-1.5 font-display font-bold not-italic">{toolMeta(r.tool_id).icon}</span>
                    {r.title}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                    <span className={cn("rounded-sm border px-1.5", ROLE_STYLE[role])}>{ROLE_LABEL[role]}</span>
                    {theory && fits(r, theory) && <span className="rounded-sm border border-green/70 px-1.5 text-green">FITS YOUR THEORY</span>}
                    {!pointsAt && <span className="text-red">doesn&apos;t point at {first}</span>}
                    {pointsAt && r.implicates.length > Math.max(1, culprits) && <span className="text-amber">points at {r.implicates.length} people</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {charge.clues.length > 0 && theory && (
          <p ref={meter} className={cn("mt-2 rounded-sm border px-3 py-1.5 text-xs", proof.tone)} data-testid="proof-meter">
            <span className="mr-2 font-type tracking-[0.25em]">{proof.label}</span>
            {proof.text}
          </p>
        )}
      </section>

      <section>
        <h3 className="font-type text-[11px] tracking-[0.35em] text-paper/60">3 · THE ROWS THAT SHOW IT</h3>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            sfx.play("rustle");
            setPicking(true);
          }}
          data-testid="pick-rows"
          className="mt-2 min-h-11 rounded-sm border border-cyan/60 px-4 text-sm text-cyan hover:bg-cyan/10"
        >
          {charge.exhibits.length ? `${charge.exhibits.length} row${charge.exhibits.length === 1 ? "" : "s"} pinned · change` : `Open ${first}'s ledger and pin the rows`}
        </button>
      </section>

      <ScoreGuide />

      {picking && (
        <RowsPicker
          caseId={caseId}
          suspect={suspect}
          picked={charge.exhibits}
          onChange={(exhibits) => onChange({ ...charge, exhibits })}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/** What the accusation is marked on: one line, open it to read more. */
function ScoreGuide() {
  return (
    <details className="group rounded-sm border border-line bg-ink-900/70 text-xs leading-relaxed text-paper/75" data-testid="score-guide">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 font-type text-[11px] tracking-[0.3em] text-paper/60 hover:text-paper">
        HOW IS THIS MARKED?
        <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="space-y-1 px-3 pb-3">
        <li><b className="text-paper">Verdict · 35</b>: the right person.</li>
        <li><b className="text-paper">Theory · 10</b>: the right trick.</li>
        <li><b className="text-paper">Proof · 10</b>: a clue from a tool marked PROVES that names only them, or two different tools that agree.</li>
        <li><b className="text-paper">Exhibits · 25</b>: up to 3 rows that show the trick is full marks. Each honest row costs you.</li>
        <li><b className="text-paper">Spending · 20</b>: don&apos;t spend much more than the case needed.</li>
      </ul>
    </details>
  );
}

// Amount next to the date, so a phone shows it without scrolling sideways
const COLUMNS = ["date", "amount", "vendor", "hour", "category", "revenue", "invoice_id"] as const;

function RowsPicker({ caseId, suspect, picked, onChange, onClose }: {
  caseId: string;
  suspect: Suspect;
  picked: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const rows = useQuery({ queryKey: ["suspect-rows", caseId, suspect.id], queryFn: () => suspectRows(caseId, suspect.id) });
  const [full, setFull] = useState(false); // a 6th row was tapped: say why nothing happened
  // Escape closes only the ledger, not the spotlight underneath (it listens on window too)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const [sort, setSort] = useState<"amount" | "date">("amount");
  const [filter, setFilter] = useState<{ col: (typeof COLUMNS)[number]; value: string } | null>(null);
  const shown = (r: LedgerRow, c: (typeof COLUMNS)[number]) => (c === "date" ? String(r[c]).slice(0, 10) : String(r[c] ?? ""));
  const list: LedgerRow[] = [...(rows.data?.rows ?? [])]
    .filter((r) => !filter || shown(r, filter.col) === filter.value)
    .sort((a, b) =>
    sort === "amount" ? Number(b.amount) - Number(a.amount) : String(a.date).localeCompare(String(b.date)) || Number(a.hour) - Number(b.hour),
  );
  const room = MAX_EXHIBITS - picked.length;
  const unpinned = list.filter((r) => !picked.includes(String(r.txn_id)));
  const pinAll = () => {
    sfx.play("tick");
    onChange([...picked, ...unpinned.slice(0, room).map((r) => String(r.txn_id))]);
  };
  const toggle = (id: string) => {
    sfx.play("tick");
    setFull(!picked.includes(id) && picked.length >= MAX_EXHIBITS);
    onChange(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < MAX_EXHIBITS ? [...picked, id] : picked);
  };

  return (
    <div role="dialog" aria-modal aria-label={`${suspect.name}'s ledger`} data-testid="rows-picker"
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-t-md border border-line bg-ink-950 sm:rounded-md">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <p className="font-type text-[11px] tracking-[0.35em] text-paper/60">PIN UP TO {MAX_EXHIBITS} ROWS</p>
            <h3 className="font-display text-2xl italic text-paper">{suspect.name}&apos;s ledger</h3>
            <p className="text-xs text-paper/60">Pin the rows that show the trick, and only those. An honest row costs you; up to 3 fraud rows is a full mark (fewer if the fraud left fewer).</p>
            <p className="text-xs text-cyan/80">Tip: tap the 🔍 beside any value (a vendor, an amount, a date) to show only rows that share it, then pin them together.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-paper/60">Sort</span>
            {(["amount", "date"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k}
                className={cn("min-h-9 rounded-sm border px-3", sort === k ? "border-amber text-amber" : "border-line text-paper/70")}>
                {k === "amount" ? "biggest first" : "by date"}
              </button>
            ))}
          </div>
        </header>
        {filter && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-cyan/10 px-4 py-2 text-xs text-paper" data-testid="rows-filter">
            <span>
              Showing {list.length} row{list.length === 1 ? "" : "s"} where <b>{filter.col}</b> = <b>{filter.value}</b>
            </span>
            <button type="button" onClick={pinAll} disabled={unpinned.length === 0 || room === 0} data-testid="pin-all"
              className="min-h-9 rounded-sm border border-cyan/60 px-3 text-cyan hover:bg-cyan/10 disabled:opacity-40">
              {room === 0 ? "Pin limit reached" : `Pin ${Math.min(room, unpinned.length)} of these`}
            </button>
            <button type="button" onClick={() => setFilter(null)} className="min-h-9 rounded-sm border border-line px-3 text-paper/80 hover:text-paper">
              Show all rows
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {rows.isLoading && <p className="p-6 text-paper/60">Pulling the files…</p>}
          {rows.isError && <p className="p-6 text-red">The ledger wouldn&apos;t open. Close this and try again.</p>}
          {rows.data && (
            <table className="w-full min-w-[640px] border-collapse font-mono text-[12px] text-paper">
              <thead className="sticky top-0 bg-ink-900">
                <tr>
                  <th className="w-10 px-2 py-2" />
                  {COLUMNS.map((c) => (
                    <th key={c} className={cn("px-2 py-2 text-left font-normal text-paper/60", (c === "amount" || c === "revenue") && "text-right")}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const id = String(r.txn_id);
                  const on = picked.includes(id);
                  return (
                    <tr key={id} onClick={() => toggle(id)} data-testid="ledger-row" data-txn={id}
                      className={cn("cursor-pointer border-b border-line/40", on ? "bg-amber/15" : "hover:bg-white/5")}>
                      <td className="px-2 py-1.5 text-center text-amber">{on ? "☑" : "☐"}</td>
                      {COLUMNS.map((c) => (
                        <td key={c} className={cn("whitespace-nowrap px-2 py-1.5", (c === "amount" || c === "revenue") && "text-right tabular-nums")}>
                          {c === "amount" || c === "revenue" ? Number(r[c]).toLocaleString("en-IN") : shown(r, c)}
                          {/* the row pins wherever you tap it; only the 🔍 filters */}
                          {c !== "invoice_id" && (
                            <button type="button" title={`Show every row with this ${c}`} aria-label={`Show every row with this ${c}`}
                              data-testid="filter-value"
                              onClick={(e) => { e.stopPropagation(); sfx.play("tick"); setFilter({ col: c, value: shown(r, c) }); }}
                              className="-my-2 ml-0.5 inline-flex size-8 items-center justify-center align-middle text-[11px] opacity-50 hover:opacity-100">
                              🔍
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <span className="flex items-center gap-3 text-sm tabular-nums text-paper/70">
            {picked.length} of {MAX_EXHIBITS} pinned
            {full && <span className="text-amber" role="status">That&apos;s the most you can pin.</span>}
            {picked.length > 0 && (
              <button type="button" onClick={() => { setFull(false); onChange([]); }} className="min-h-9 px-2 text-xs text-red underline">clear all</button>
            )}
          </span>
          <button type="button" onClick={onClose} data-testid="rows-done"
            className="min-h-11 bg-[#ffd319] px-6 font-pixel text-xs text-[#05060d] shadow-[3px_3px_0_#ff2a6d]">
            DONE
          </button>
        </footer>
      </div>
    </div>
  );
}
