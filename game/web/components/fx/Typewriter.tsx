"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { useReducedEffects } from "@/lib/useReducedEffects";

/** Types `text` out one character at a time, with optional key clicks. */
export function Typewriter({
  text, speed = 28, delay = 0, sound = true, cursor = true, onDone, className,
}: {
  text: string;
  speed?: number;
  delay?: number;
  sound?: boolean;
  cursor?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const reduced = useReducedEffects();
  // Progress is tracked per text, so a new text starts from zero without a reset effect.
  const [progress, setProgress] = useState({ text, count: 0 });
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (reduced) {
      done.current?.();
      return;
    }
    let i = 0;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i++;
        setProgress({ text, count: i });
        if (sound && i % 2 === 0 && text[i - 1] !== " ") sfx.play("type");
        if (i >= text.length) {
          window.clearInterval(interval);
          done.current?.();
        }
      }, speed);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [text, speed, delay, sound, reduced]);

  const count = reduced ? text.length : progress.text === text ? progress.count : 0;
  const typing = count < text.length;
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      {cursor && <span aria-hidden className={typing ? "" : "animate-blink"}>▌</span>}
    </span>
  );
}
