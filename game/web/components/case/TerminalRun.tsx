"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";

/**
 * A green-on-black terminal that streams the Python source the server just ran.
 * With `code` null it shows the "calling the server" prompt with a blinking cursor.
 */
export function TerminalRun({ code, command, duration = 800, onDone }: {
  code: string | null;
  command: string;
  duration?: number;
  onDone?: () => void;
}) {
  const reduced = useReducedEffects();
  const lines = code ? code.replace(/\s+$/, "").split("\n") : [];
  const [shown, setShown] = useState({ code, count: 0 });
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!code) return;
    const total = code.replace(/\s+$/, "").split("\n").length;
    if (reduced) {
      done.current?.();
      return;
    }
    let i = 0;
    const step = Math.max(12, duration / total);
    const id = window.setInterval(() => {
      i = Math.min(total, i + 1);
      setShown({ code, count: i });
      if (i % 3 === 0) sfx.play("terminal");
      if (i >= total) {
        window.clearInterval(id);
        window.setTimeout(() => done.current?.(), 220);
      }
    }, step);
    return () => window.clearInterval(id);
  }, [code, duration, reduced]);

  const count = reduced ? lines.length : shown.code === code ? shown.count : 0;
  return (
    <div
      data-testid="terminal-run"
      className="relative h-[380px] overflow-hidden rounded-md border border-green/25 bg-[#030805] p-4 font-mono text-[12px] leading-[1.55] text-green shadow-[inset_0_0_60px_rgba(61,214,140,0.06)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.25)_0_1px,transparent_1px_3px)]" />
      <p className="text-green/60">auditor@bureau:~$ {command}</p>
      <div className="mt-2 whitespace-pre">
        {lines.slice(Math.max(0, count - 22), count).map((line, i) => (
          <div key={i}>{line || " "}</div>
        ))}
      </div>
      <span className="animate-blink">▌</span>
    </div>
  );
}
