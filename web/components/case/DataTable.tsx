"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRows } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import type { Suspect } from "@/lib/types";
import { useFocusTrap } from "@/lib/useFocusTrap";

const PAGE = 200;
const ROW_H = 34;
type Row = Record<string, string | number>;
const COLUMNS: { key: string; label: string; width: string; align?: "right" }[] = [
  { key: "txn_id", label: "txn", width: "80px" },
  { key: "date", label: "date", width: "112px" },
  { key: "hour", label: "hr", width: "40px", align: "right" },
  { key: "employee_id", label: "employee", width: "140px" },
  { key: "vendor", label: "vendor", width: "minmax(170px,1.4fr)" },
  { key: "category", label: "category", width: "110px" },
  { key: "amount", label: "amount", width: "110px", align: "right" },
  { key: "revenue", label: "deal revenue", width: "120px", align: "right" },
  { key: "invoice_id", label: "invoice", width: "100px" },
];
const GRID = COLUMNS.map((c) => c.width).join(" ");

export function DataTable({ caseId, open, onClose, suspects, implicated, flaggedTxns }: {
  caseId: string;
  open: boolean;
  onClose: () => void;
  suspects: Suspect[];
  implicated: string[];
  flaggedTxns: Set<string>;
}) {
  const trap = useFocusTrap<HTMLElement>(open);

  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [who, setWho] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);
  const nameOf = (id: string) => suspects.find((s) => s.id === id)?.name ?? id;

  const query = useInfiniteQuery({
    queryKey: ["rows", caseId],
    queryFn: ({ pageParam }) => getRows(caseId, pageParam, PAGE),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: open,
  });
  const loaded = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const needsAll = sort !== null || who !== "all";

  // Sorting or filtering only makes sense over the whole ledger: fetch the rest.
  useEffect(() => {
    if (open && needsAll && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [open, needsAll, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const rows = useMemo(() => {
    let out: Row[] = who === "all" ? loaded : loaded.filter((r) => r.employee_id === who);
    if (sort) {
      out = [...out].sort((a, b) => {
        const x = a[sort.key], y = b[sort.key];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
  }, [loaded, who, sort]);

  // TanStack Virtual returns fresh functions each render; the React Compiler lint can't memoize it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const lastIndex = items.at(-1)?.index ?? 0;

  useEffect(() => {
    if (lastIndex >= rows.length - 40 && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [lastIndex, rows.length, query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[95] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={trap}
            tabIndex={-1}
            role="dialog"
            aria-label="Raw ledger"
            data-testid="data-table"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[96] flex h-[82dvh] flex-col rounded-t-xl border-t border-amber/30 bg-ink-950 shadow-[0_-20px_60px_rgba(0,0,0,0.7)]"
          >
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-line" />
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div className="mr-auto">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber/80">The ledger</p>
                <h2 className="font-display text-xl italic text-paper">Every transaction, raw</h2>
              </div>
              <div role="radiogroup" aria-label="Filter by employee" className="flex flex-wrap gap-1">
                {[{ id: "all", name: "Everyone" }, ...suspects].map((s) => (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={who === s.id}
                    onClick={() => setWho(s.id)}
                    className={cn(
                      "rounded-sm border px-2 py-0.5 font-mono text-[11px]",
                      who === s.id ? "border-amber bg-amber/15 text-amber" : "border-line text-muted hover:text-paper",
                      implicated.includes(s.id) && who !== s.id && "border-red/60 text-red/90",
                    )}
                  >
                    {s.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-sm border border-line px-2.5 py-1 font-mono text-xs text-muted hover:text-paper">
                esc ✕
              </button>
            </header>

            <div ref={scrollRef} data-testid="data-scroll" className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-[1000px]">
                <div
                  role="row"
                  className="sticky top-0 z-10 grid border-b border-line bg-ink-900 font-mono text-[10px] uppercase tracking-widest text-muted"
                  style={{ gridTemplateColumns: GRID }}
                >
                  {COLUMNS.map((c) => (
                    <button
                      key={c.key}
                      role="columnheader"
                      onClick={() =>
                        setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))
                      }
                      className={cn("px-3 py-2 text-left hover:text-amber", c.align === "right" && "text-right")}
                    >
                      {c.label}
                      {sort?.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                    </button>
                  ))}
                </div>
                <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                  {items.map((item) => {
                    const row = rows[item.index];
                    const emp = String(row.employee_id);
                    const hot = implicated.includes(emp);
                    const flagged = flaggedTxns.has(String(row.txn_id));
                    return (
                      <div
                        key={item.key}
                        data-testid="data-row"
                        data-implicated={hot}
                        className={cn(
                          "absolute inset-x-0 grid items-center border-b border-line/30 border-l-[3px] font-mono text-[12px]",
                          hot ? "border-l-red bg-red/[0.06]" : "border-l-transparent",
                          flagged && "bg-red/20 text-[#ffd9da]",
                          item.index % 2 === 1 && !hot && !flagged && "bg-white/[0.015]",
                        )}
                        style={{ height: ROW_H, transform: `translateY(${item.start}px)`, gridTemplateColumns: GRID }}
                      >
                        <span className="px-3 text-muted">{flagged ? "⚑ " : ""}{row.txn_id}</span>
                        <span className="whitespace-nowrap px-3">{String(row.date).slice(0, 10)}</span>
                        <span className="px-3 text-right">{row.hour}</span>
                        <span className="truncate px-3 text-paper">{nameOf(emp)}</span>
                        <span className="truncate px-3 text-paper/80">{row.vendor}</span>
                        <span className="truncate px-3 text-muted">{String(row.category).replace(/_/g, " ")}</span>
                        <span className="px-3 text-right text-amber">{formatINR(Number(row.amount), 2)}</span>
                        <span className="px-3 text-right text-paper/60">{formatINR(Number(row.revenue))}</span>
                        <span className="truncate px-3 text-muted">{row.invoice_id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <footer className="border-t border-line px-4 py-2 font-mono text-[11px] text-muted sm:px-6">
              {query.isError ? (
                <span className="text-red">The records room is not answering.</span>
              ) : (
                <>
                  showing <span data-testid="row-count" className="text-paper">{rows.length}</span> · loaded {loaded.length} of {total}
                  {query.isFetching && " · fetching…"}
                </>
              )}
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
