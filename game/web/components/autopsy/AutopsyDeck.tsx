"use client";
import { BackButton } from "@/components/ui/BackButton";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { PlotlyChart } from "@/components/case/PlotlyChart";
import { Typewriter } from "@/components/fx/Typewriter";
import { ApiError, getAutopsy } from "@/lib/api";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { CodePanel } from "./CodePanel";
import { takeaway } from "./takeaway";

type Figure = { data?: unknown[]; layout?: Record<string, unknown> };

/** The slide already says the title out loud: drop the chart's own and park the legend top-right.
 *  On a projector every label is bigger, to read from the back row. */
function forSlide(figure: Figure, projector: boolean): Figure {
  const size = projector ? 18 : 12;
  // the chart theme sets axis font sizes itself: override them, or the back row can't read them
  const axis = (key: string) => {
    const a = (figure.layout?.[key] ?? {}) as Record<string, unknown>;
    const title = (typeof a.title === "object" && a.title ? a.title : { text: a.title }) as Record<string, unknown>;
    return { ...a, tickfont: { ...((a.tickfont as object) ?? {}), size }, title: { ...title, font: { ...((title.font as object) ?? {}), size } } };
  };
  return {
    ...figure,
    layout: {
      ...figure.layout,
      xaxis: axis("xaxis"),
      yaxis: axis("yaxis"),
      title: { text: "" },
      font: { ...((figure.layout?.font as object) ?? {}), size },
      legend: { orientation: "h", x: 1, xanchor: "right", y: 1.02, yanchor: "bottom", font: { size } },
    },
  };
}

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

export function AutopsyDeck({ code }: { code: string }) {
  const autopsy = useQuery({ queryKey: ["autopsy", code], queryFn: () => getAutopsy(code) });
  const slides = autopsy.data?.slides ?? [];
  const total = slides.length + 1; // + cold open
  const [index, setIndex] = useState(0);
  const [showCode, setShowCode] = useState(true);
  // The projector gets a big chart; phones get one that fits above the code.
  const projector = useMediaQuery("(min-width: 1024px)") ?? true;
  // The chart fills what's left of the screen under the title and above the footer, so a 720p
  // projector never pushes it off the bottom.
  const viewport = useSyncExternalStore(onResize, () => window.innerHeight, () => 900);
  const chartHeight = projector ? Math.max(300, Math.min(700, viewport - 380)) : 340;
  const touch = useMediaQuery("(pointer: coarse)") ?? false;
  const missing = autopsy.error instanceof ApiError && autopsy.error.status === 404;

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
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_50%_-20%,#1b2540_0%,#07080b_60%)] px-4 py-6 sm:px-10 sm:py-8 lg:h-dvh lg:overflow-hidden">
      <header className="flex items-center justify-between text-lg text-paper/60">
        <BackButton href={`/host/${code}`} label={`Room ${code}`} />
        <span data-testid="slide-counter" className="text-xl">
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
            <p className="m-auto px-4 text-center text-2xl text-red">
              {missing ? `There's no room ${code}, or it has closed.` : "Couldn't reach the game server. Check the Wi-Fi and reload."}
            </p>
          ) : !slide ? (
            <div className="m-auto max-w-5xl text-center">
              <p className="font-type text-xl tracking-[0.5em] text-cyan">CLASS AUTOPSY</p>
              <h1 className="mt-6 font-display text-[clamp(56px,7vw,112px)] font-black italic leading-none text-paper">
                The class becomes the dataset.
              </h1>
              <p className="mt-8 text-2xl text-paper/70">
                <Typewriter text="Every click you made is now a row in a pandas DataFrame." speed={35} sound={false} />
              </p>
              <p className="mt-14 text-lg text-paper/60">{touch ? "Tap → to begin" : "Press → to begin"}</p>
            </div>
          ) : (
            <>
              <div className="mb-6 mt-6">
                <h2 data-testid="slide-title" className="font-display text-3xl font-black italic text-paper sm:text-5xl">
                  {slide.title}
                </h2>
                <p className="mt-3 text-xl text-amber sm:text-3xl">{takeaway(slide.title, slide.stats)}</p>
              </div>
              <div
                className={cn(
                  "grid min-h-0 flex-1 gap-6",
                  showCode ? "grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid-cols-1",
                )}
              >
                <div className="min-h-0 rounded-xl border border-line bg-ink-900/60 p-4">
                  <PlotlyChart figure={forSlide(slide.figure, projector)} height={chartHeight} />
                </div>
                {showCode && (
                  <div className="flex min-h-0 flex-col">
                    <p className="mb-2 text-xl text-paper/70">The pandas that made it</p>
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

      {!autopsy.isError && (
        <footer className="relative z-10 mt-4 flex items-center justify-between gap-3">
          <button onClick={() => go(-1)} disabled={index === 0} className="flex size-12 items-center justify-center rounded-lg text-3xl text-paper/70 hover:bg-white/5 disabled:opacity-20" aria-label="Previous slide">
            ←
          </button>
          <div className="flex" data-testid="progress-pips">
            {Array.from({ length: total }, (_, i) => (
              <button key={i} aria-label={`Slide ${i + 1}`} onClick={() => setIndex(i)} className="flex h-10 items-center px-1.5">
                <span className={cn("h-2.5 rounded-full transition-all", i === index ? "w-10 bg-amber" : "w-2.5 bg-paper/25")} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {slide && (
              <button onClick={() => setShowCode((s) => !s)} className="min-h-11 whitespace-nowrap text-lg text-paper/70 hover:text-paper">
                {showCode ? "Hide code" : "Show code"}<span className="hidden lg:inline"> (C)</span>
              </button>
            )}
            <button
              onClick={() => go(1)}
              disabled={index === total - 1}
              className="flex size-12 items-center justify-center rounded-lg text-3xl text-paper/70 hover:bg-white/5 disabled:opacity-20"
              aria-label="Next slide"
            >
              →
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}
