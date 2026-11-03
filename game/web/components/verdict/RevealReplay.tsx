"use client";
import { useEffect, useMemo, useState } from "react";
import { PlotlyChart } from "@/components/case/PlotlyChart";
import { revealFigure, type Figure } from "@/lib/plotlyData";
import { sfx } from "@/lib/sound";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useReducedEffects } from "@/lib/useReducedEffects";

/** The ledger replayed: the fraudulent claims light up red, one after another. */
export function RevealReplay({ figure, play }: { figure: Figure; play: boolean }) {
  const reduced = useReducedEffects();
  const phone = useMediaQuery("(max-width: 639px)") ?? false;
  const count = useMemo(() => revealFigure(figure, 0).fraudCount, [figure]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!play || reduced || count === 0) return;
    const step = Math.max(1, Math.ceil(count / 24)); // whole replay lasts about three seconds
    const id = window.setInterval(() => {
      setShown((s) => {
        const next = Math.min(count, s + step);
        if (next >= count) window.clearInterval(id);
        return next;
      });
      sfx.play("pin");
    }, 120);
    return () => window.clearInterval(id);
  }, [play, reduced, count]);

  const visible = reduced ? count : shown;
  const fig = useMemo(() => revealFigure(figure, visible), [figure, visible]);
  // On phones the horizontal legend wraps over the plot: draw our own underneath instead.
  const layout = phone ? { ...fig.layout, showlegend: false } : fig.layout;
  const names = (figure.data ?? []).map((t) => String(t.name ?? ""));

  return (
    <div data-testid="reveal-replay" data-shown={visible} data-total={count} className="rounded-lg border border-line bg-ink-900/80 p-2 sm:p-3">
      <PlotlyChart figure={{ data: fig.data, layout }} height={phone ? 300 : 380} compact={phone} />
      {phone && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1 text-[11px] text-paper/80">
          {names.map((name, i) => (
            <li key={name} className="flex items-center gap-1.5">
              <span aria-hidden className={i === names.length - 1 ? "text-red" : i === 0 ? "text-muted" : "text-amber"}>
                {i === names.length - 1 ? "✕" : "●"}
              </span>
              {name}
            </li>
          ))}
        </ul>
      )}
      <p className="px-2 pb-1 font-mono text-[11px] text-muted">
        <span className="text-red">✕ {visible}</span> / {count} fraudulent claims exposed
      </p>
    </div>
  );
}
