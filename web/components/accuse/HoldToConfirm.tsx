"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";

const R = 54;
const C = 2 * Math.PI * R;

/** A button you must hold (mouse, touch, Space or Enter) until the ring fills. */
export function HoldToConfirm({ onConfirm, duration = 1500, disabled = false, label, sublabel, small = false }: {
  onConfirm: () => void;
  /** a smaller button, for the action bar pinned to the bottom of the screen */
  small?: boolean;
  duration?: number;
  disabled?: boolean;
  label: string;
  sublabel?: string;
}) {
  const [progress, setProgress] = useState(0);
  const raf = useRef(0);
  const started = useRef<number | null>(null);
  const fired = useRef(false);
  const lastTick = useRef(0);

  const [nudge, setNudge] = useState(false); // let go too early: say so
  const progressRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // The confirm action ran but failed (the caller enables the button again): allow another hold.
  // Without this the button stayed "fired" and every later hold did nothing until a reload.
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      fired.current = false;
      progressRef.current = 0;
      setProgress(0);
    }
    wasDisabled.current = disabled;
  }, [disabled]);
  useEffect(() => {
    if (!nudge) return;
    const t = window.setTimeout(() => setNudge(false), 1600);
    return () => window.clearTimeout(t);
  }, [nudge]);

  const tick = (now: number) => {
    if (started.current === null) started.current = now;
    const p = Math.min(1, (now - started.current) / duration);
    progressRef.current = p;
    setProgress(p);
    if (now - lastTick.current > 140) {
      lastTick.current = now;
      sfx.play("tick");
    }
    if (p >= 1) {
      fired.current = true;
      onConfirm();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (disabled || fired.current) return;
    setNudge(false);
    cancelAnimationFrame(raf.current);
    started.current = null;
    raf.current = requestAnimationFrame(tick);
  };

  const release = () => {
    cancelAnimationFrame(raf.current);
    if (fired.current) return;
    if (progressRef.current > 0) setNudge(true); // a click, or let go before the ring filled
    progressRef.current = 0;
    setProgress(0);
  };

  return (
    <button
      type="button"
      data-testid="hold-to-accuse"
      data-progress={progress.toFixed(2)}
      disabled={disabled}
      aria-label={`${label} — press and hold`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") release();
      }}
      className={cn(
        "relative grid shrink-0 touch-none select-none place-items-center rounded-full",
        small ? "h-24 w-24" : "h-36 w-36",
        "bg-[radial-gradient(circle,#3a0d10_0%,#1a0607_70%)] shadow-[0_0_40px_rgba(229,72,77,0.35)]",
        "transition-transform active:scale-95 disabled:opacity-50",
      )}
    >
      <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(229,72,77,0.2)" strokeWidth="6" />
        <circle cx="64" cy="64" r={R} fill="none" stroke="#e5484d" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
          style={{ filter: "drop-shadow(0 0 6px rgba(229,72,77,0.9))" }} />
      </svg>
      <span className="relative text-center font-type leading-tight text-[#ffd9da]">
        <span className={cn("block tracking-[0.2em]", small ? "text-base" : "text-lg")}>{label}</span>
        {(nudge || sublabel) && (
          <span className={cn("block", nudge ? "text-amber" : "text-red/80", small ? "text-[8px] tracking-[0.2em]" : "text-[10px] tracking-[0.3em]")}>
            {nudge ? "KEEP HOLDING" : sublabel}
          </span>
        )}
      </span>
    </button>
  );
}
