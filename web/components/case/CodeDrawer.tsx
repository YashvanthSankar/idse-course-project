"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { formatStat, statName } from "@/lib/format";
import { sfx } from "@/lib/sound";
import type { Suspect, ToolResult } from "@/lib/types";

function useHighlighted(code: string | null) {
  const [html, setHtml] = useState<{ code: string; html: string } | null>(null);
  useEffect(() => {
    if (!code) return;
    let alive = true;
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(code, { lang: "python", theme: "github-dark" }))
      .then((out) => alive && setHtml({ code, html: out }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code]);
  return html && html.code === code ? html.html : null;
}

export function CodeDrawer({
  result,
  onClose,
  suspects = [],
}: {
  result: ToolResult | null;
  onClose: () => void;
  suspects?: Suspect[];
}) {
  const names = Object.fromEntries(suspects.map((s) => [s.id, s.name]));
  const html = useHighlighted(result?.code ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  return (
    <AnimatePresence>
      {result && (
        <>
          <motion.div
            className="fixed inset-0 z-[95] bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Under the hood"
            data-testid="code-drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-[96] flex max-h-[78dvh] flex-col rounded-t-xl border-t border-green/30 bg-ink-950 shadow-[0_-20px_60px_rgba(0,0,0,0.7)]"
          >
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-line" />
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div className="mr-auto">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-green/80">Under the hood</p>
                <h2 className="font-display text-xl italic text-paper">{result.title}</h2>
                <p className="text-[11px] text-muted">The exact Python function that just ran on the server.</p>
              </div>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(result.code).then(() => setCopied(true));
                  sfx.play("tick");
                  window.setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-sm border border-green/50 px-3 py-1 font-mono text-xs text-green hover:bg-green/10"
              >
                {copied ? "copied ✓" : "copy code"}
              </button>
              <button onClick={onClose} aria-label="Close" className="rounded-sm border border-line px-2.5 py-1 font-mono text-xs text-muted hover:text-paper">
                esc ✕
              </button>
            </header>
            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_300px]">
              <div className="min-h-0 overflow-auto p-4 text-[12.5px] leading-relaxed sm:p-6 [&_pre]:!bg-transparent [&_pre]:font-mono">
                {html ? (
                  <div data-testid="code-html" dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <pre className="whitespace-pre font-mono text-paper/80">{result.code}</pre>
                )}
              </div>
              <dl className="min-h-0 overflow-auto border-t border-line p-4 font-mono text-[13px] md:border-l md:border-t-0">
                <p className="mb-2 text-xs text-paper/60">Numbers behind the finding</p>
                {Object.entries(result.stats).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line/40 py-1">
                    <dt className="truncate text-paper/65" title={k}>{statName(k, names)}</dt>
                    <dd className="text-amber">{formatStat(k, v as number | string)}</dd>
                  </div>
                ))}
                <p className="mb-2 mt-4 text-xs text-paper/60">Points at</p>
                <p className="text-red">{result.implicates.map((id) => names[id] ?? id).join(", ") || "nobody"}</p>
              </dl>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
