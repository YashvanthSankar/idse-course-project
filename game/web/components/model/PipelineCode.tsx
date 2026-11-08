"use client";
import { useEffect, useState } from "react";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One notebook cell's Python, folded by default; highlighted with Shiki the first time it is
 *  opened. Long lines wrap inside the block, so a phone never scrolls sideways. */
export function PipelineCode({ code, label = "Show the code" }: { code: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const lines = code.split("\n").length;

  useEffect(() => {
    if (!open || html) return;
    let alive = true;
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(code, { lang: "python", theme: "github-dark" }))
      .then((out) => alive && setHtml(out))
      .catch(() => alive && setHtml(`<pre><code>${escape(code)}</code></pre>`));
    return () => {
      alive = false;
    };
  }, [open, html, code]);

  return (
    <details className="group/code min-w-0 rounded-xl border border-[var(--m-line)] bg-[#0d0e0c]" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-2.5 text-[13px] text-[var(--m-ink-2)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--m-s2)]" />
          <span className="group-open/code:hidden">{label}</span>
          <span className="hidden group-open/code:inline">Hide the code</span>
          <span className="text-[var(--m-ink-3)]">· Python, {lines} line{lines === 1 ? "" : "s"}</span>
        </span>
        <span aria-hidden className="text-[var(--m-ink-3)] transition-transform group-open/code:rotate-180">⌄</span>
      </summary>
      <div
        className="min-w-0 border-t border-[var(--m-line)] px-4 py-3 font-mono text-[12.5px] leading-[1.6] [&_code]:block [&_pre]:!bg-transparent [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
        dangerouslySetInnerHTML={{ __html: html ?? `<pre class="text-[var(--m-ink-2)]"><code>${escape(code)}</code></pre>` }}
      />
    </details>
  );
}
