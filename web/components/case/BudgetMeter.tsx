"use client";
import { motion, useAnimate } from "framer-motion";
import { useEffect } from "react";

/** Budget as a row of gold coins. `errorTick` changing makes the meter shake. */
export function BudgetMeter({ budget, left, errorTick }: { budget: number; left: number; errorTick: number }) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (errorTick === 0 || !scope.current) return;
    void animate(scope.current, { x: [0, -8, 7, -5, 3, 0] }, { duration: 0.4 });
  }, [errorTick, animate, scope]);

  return (
    <div
      ref={scope}
      data-testid="budget-meter"
      aria-label={`Budget ${left} of ${budget}`}
      className="flex items-center gap-2"
    >
      <span className="hidden text-xs text-paper/55 sm:inline">Budget</span>
      <div className="flex flex-wrap items-center gap-[3px]">
        {Array.from({ length: budget }, (_, i) => {
          const full = i < left;
          return (
            <motion.span
              key={i}
              initial={false}
              animate={full ? { y: 0, opacity: 1, scale: 1 } : { y: [0, -6, 4], opacity: 0.9, scale: 0.8 }}
              transition={{ duration: 0.35, delay: full ? 0 : (budget - i) * 0.02 }}
              className={
                full
                  ? "h-3 w-3 rounded-full border border-[#8a5a10] bg-[radial-gradient(circle_at_35%_30%,#ffe29a,#f5a524_55%,#9a6212)] shadow-[0_0_6px_rgba(245,165,36,0.5)]"
                  : "h-3 w-3 rounded-full border border-line bg-transparent"
              }
            />
          );
        })}
      </div>
      <span className={`font-mono text-sm tabular-nums ${left === 0 ? "text-red" : "text-amber"}`}>
        {left}/{budget}
      </span>
    </div>
  );
}
