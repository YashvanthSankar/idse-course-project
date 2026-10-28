"use client";
import { useEffect, useRef } from "react";
import { useReducedEffects } from "@/lib/useReducedEffects";

/** A warm desk-lamp pool of light that follows the pointer. */
export function LampLight({ size = 650 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedEffects();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--lx", `${e.clientX}px`);
        el.style.setProperty("--ly", `${e.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] mix-blend-soft-light"
      style={{
        background: `radial-gradient(${size}px circle at var(--lx, 50%) var(--ly, 35%), rgb(245 165 36 / 0.22), transparent 65%)`,
      }}
    />
  );
}
