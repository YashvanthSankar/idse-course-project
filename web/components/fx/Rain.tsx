"use client";
import { useEffect, useRef } from "react";
import { useReducedEffects } from "@/lib/useReducedEffects";

type Drop = { x: number; y: number; len: number; speed: number; alpha: number };

/** Canvas rain streaking across the window. Static (one frame) under reduced effects. */
export function Rain({ density = 300, lightning = false, className = "" }: {
  density?: number;
  lightning?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedEffects();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let w = 0, h = 0, raf = 0, flash = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const make = (): Drop => ({
      x: Math.random() * (w + 200) - 100,
      y: Math.random() * h - h,
      len: 10 + Math.random() * 22,
      speed: 9 + Math.random() * 10,
      alpha: 0.08 + Math.random() * 0.25,
    });
    const drops = Array.from({ length: density }, make).map((d) => ({ ...d, y: Math.random() * h }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (flash > 0) {
        ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.18})`;
        ctx.fillRect(0, 0, w, h);
        flash *= 0.86;
        if (flash < 0.02) flash = 0;
      }
      ctx.lineCap = "round";
      for (const d of drops) {
        ctx.strokeStyle = `rgba(170, 200, 230, ${d.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
        ctx.stroke();
      }
    };
    const step = () => {
      for (const d of drops) {
        d.y += d.speed;
        d.x -= d.speed * 0.18;
        if (d.y > h) Object.assign(d, make(), { y: -20 });
      }
      if (lightning && flash === 0 && Math.random() < 0.0015) flash = 1;
      draw();
      raf = requestAnimationFrame(step);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(step);
    };

    if (reduced) draw();
    else raf = requestAnimationFrame(step);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, lightning, reduced]);

  return (
    <canvas
      ref={ref}
      data-fx="rain"
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
