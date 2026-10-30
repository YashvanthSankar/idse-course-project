"use client";
import { useEffect, useState } from "react";

/** Syntax-highlighted Python, the way the projector should show it. */
export function CodePanel({ code }: { code: string }) {
  const [html, setHtml] = useState<{ code: string; html: string } | null>(null);
  useEffect(() => {
    let alive = true;
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(code, { lang: "python", theme: "github-dark" }))
      .then((out) => alive && setHtml({ code, html: out }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code]);
  const ready = html && html.code === code;
  return (
    <div
      data-testid="autopsy-code"
      // whitespace-pre keeps Python's indentation honest (wrapped lines would restart at column 0)
      className="h-full overflow-auto rounded-xl border border-line bg-ink-950 p-5 text-[clamp(13px,0.95vw,18px)] leading-relaxed [&_pre]:!bg-transparent [&_pre]:whitespace-pre"
    >
      {ready ? (
        <div dangerouslySetInnerHTML={{ __html: html.html }} />
      ) : (
        <pre className="whitespace-pre font-mono text-paper/70">{code}</pre>
      )}
    </div>
  );
}
