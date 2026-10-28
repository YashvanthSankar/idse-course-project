"use client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PlotlyChart } from "@/components/case/PlotlyChart";
import { Typewriter } from "@/components/fx/Typewriter";
import { getAutopsy } from "@/lib/api";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { CodePanel } from "./CodePanel";
import { takeaway } from "./takeaway";

type Figure = { data?: unknown[]; layout?: Record<string, unknown> };

/** The slide already says the title out loud: drop the chart's own and park the legend top-right. */
function forSlide(figure: Figure): Figure {
  return {
    ...figure,
    layout: {
      ...figure.layout,
      title: { text: "" },
      legend: { orientation: "h", x: 1, xanchor: "right", y: 1.02, yanchor: "bottom", font: { size: 14 } },
    },
  };
}

export function AutopsyDeck({ code }: { code: string }) {
  const autopsy = useQuery({ queryKey: ["autopsy", code], queryFn: () => getAutopsy(code) });
  const slides = autopsy.data?.slides ?? [];
  const total = slides.length + 1; // + cold open
  const [index, setIndex] = useState(0);
  const [showCode, setShowCode] = useState(true);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = Math.min(total - 1, Math.max(0, i + delta));
        if (next !== i) sfx.play("whoosh");
        return next;
      });
    },
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        go(-1);
      } else if (e.key.toLowerCase() === "c") {
        setShowCode((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const slide = index > 0 ? slides[index - 1] : null;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_-20%,#1b2540_0%,#07080b_60%)] px-10 py-8">
      <header className="flex items-center justify-between text-lg text-paper/60">
        <Link href={`/host/${code}`} className="hover:text-paper">← Room {code}</Link>
        <span data-testid="slide-counter">
          {index + 1} / {total}
        </span>
      </header>

      <AnimatePresence mode="wait">
        <motion.section
          key={index}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
          className="flex min-h-0 flex-1 flex-col"
          data-testid="autopsy-slide"
        >
          {autopsy.isPending ? (
            <p className="m-auto text-2xl text-paper/60">Running the numbers…</p>
          ) : autopsy.isError ? (
            <p className="m-auto text-2xl text-red">Couldn&apos;t load the autopsy. Is the backend running?</p>
          ) : !slide ? (
            <div className="m-auto max-w-5xl text-center">
              <p className="font-type text-xl tracking-[0.5em] text-cyan">CLASS AUTOPSY</p>
              <h1 className="mt-6 font-display text-[clamp(56px,7vw,112px)] font-black italic leading-none text-paper">
                The class becomes the dataset.
              </h1>
              <p className="mt-8 text-2xl text-paper/70">
                <Typewriter text="Every click you made is now a row in a pandas DataFrame." speed={35} sound={false} />
              </p>
              <p className="mt-14 text-lg text-paper/40">Press → to begin</p>
            </div>
          ) : (
            <>
              <div className="mb-6 mt-6">
                <h2 data-testid="slide-title" className="font-display text-5xl font-black italic text-paper">
                  {slide.title}
                </h2>
                <p className="mt-3 text-3xl text-amber">{takeaway(slide.title, slide.stats)}</p>
              </div>
              <div
                className={cn(
                  "grid min-h-0 flex-1 gap-6",
                  showCode ? "grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-1",
                )}
              >
                <div className="min-h-0 rounded-xl border border-line bg-ink-900/60 p-4">
                  <PlotlyChart figure={forSlide(slide.figure)} height={700} />
                </div>
                {showCode && (
                  <div className="flex min-h-0 flex-col">
                    <p className="mb-2 text-lg text-paper/60">The pandas that made it</p>
                    <div className="min-h-0 flex-1">
                      <CodePanel code={slide.code} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>

      <footer className="mt-6 flex items-center justify-between">
        <button onClick={() => go(-1)} disabled={index === 0} className="text-xl text-paper/60 disabled:opacity-20" aria-label="Previous slide">
          ←
        </button>
        <div className="flex gap-2" data-testid="progress-pips">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-10 bg-amber" : "w-2 bg-line")}
            />
          ))}
        </div>
        <div className="flex items-center gap-6">
          {slide && (
            <button onClick={() => setShowCode((s) => !s)} className="text-lg text-paper/60 hover:text-paper">
              {showCode ? "Hide code (C)" : "Show code (C)"}
            </button>
          )}
          <button
            onClick={() => go(1)}
            disabled={index === total - 1}
            className="text-xl text-paper/60 disabled:opacity-20"
            aria-label="Next slide"
          >
            →
          </button>
        </div>
      </footer>
    </main>
  );
}
