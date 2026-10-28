"use client";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";

/** A visible way back, on every screen. On phones it shrinks to the arrow + a short word. */
export function BackButton({ href, label, short, className }: {
  href: string;
  label: string;
  short?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => sfx.play("tick")}
      aria-label={`← ${label}`}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-ink-950/60 px-3 text-sm text-paper/80 backdrop-blur transition-colors hover:border-amber/60 hover:text-amber",
        className,
      )}
    >
      <span aria-hidden>←</span>
      <span aria-hidden className="hidden sm:inline">{label}</span>
      <span aria-hidden className="sm:hidden">{short ?? label}</span>
    </Link>
  );
}
