"use client";
import { useEffect, useRef, useState } from "react";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Long lines wrap, but under their own indentation (a hanging indent), so Python still reads
 *  as Python on a projector: nothing is cut off on the right and no wrapped line restarts at
 *  column 0. Works on Shiki's output (one .line span per line) and on plain text. */
function hang(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const code = doc.querySelector("code") ?? doc.body;
  for (const node of Array.from(code.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node.remove(); // the "\n" between lines
  }
  doc.querySelectorAll<HTMLElement>(".line").forEach((line) => {
    const indent = (line.textContent ?? "").match(/^ */)![0].length;
    let left = indent;
    const walker = doc.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    while (left > 0) {
      const text = walker.nextNode() as Text | null;
      if (!text) break;
      const strip = Math.min(left, text.data.length - text.data.trimStart().length);
      text.data = text.data.slice(strip);
      left -= strip;
      if (text.data.length) break;
    }
    // the indent is capped (a narrow phone panel must not give a nested line zero width), and an
    // unbreakable token may break anywhere rather than run off the edge
    line.style.cssText += `display:block;padding-left:min(${indent + 4}ch,33%);text-indent:-4ch;min-height:1lh;overflow-wrap:anywhere`;
  });
  return doc.body.innerHTML;
}

/** Syntax-highlighted Python, the way the projector should show it. */
export function CodePanel({ code }: { code: string }) {
  const [html, setHtml] = useState<{ code: string; html: string } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    let alive = true;
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(code, { lang: "python", theme: "github-dark" }))
      .then((out) => alive && setHtml({ code, html: hang(out) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code]);

  // Nobody scrolls a projector by accident: say so when the code runs past the bottom.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [html, code]);

  const ready = html && html.code === code;
  const plain = `<pre><code>${code.split("\n").map((l) => `<span class="line">${escape(l)}</span>`).join("")}</code></pre>`;
  return (
    <div className="relative h-full">
      <div
        ref={box}
        data-testid="autopsy-code"
        className="h-full overflow-auto rounded-xl border border-line bg-ink-950 p-5 font-mono text-[clamp(12px,0.85vw,17px)] leading-relaxed text-paper/80 [&_pre]:!bg-transparent [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
        dangerouslySetInnerHTML={{ __html: ready ? html.html : typeof window === "undefined" ? plain : hang(plain) }}
      />
      {more && (
        <p aria-hidden className="pointer-events-none absolute inset-x-px bottom-px rounded-b-xl bg-gradient-to-t from-ink-950 via-ink-950/90 to-transparent px-5 pb-2 pt-12 text-right text-lg text-amber">
          ↓ more
        </p>
      )}
    </div>
  );
}
