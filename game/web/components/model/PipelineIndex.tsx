"use client";
import { useEffect, useRef, useState } from "react";

type Group = { id: string; title: string; stages: { id: string; title: string }[] };

/** The list of steps beside the notebook; the step being read is marked. */
export function PipelineIndex({ groups, extra }: { groups: Group[]; extra: { id: string; title: string }[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  const list = useRef<HTMLElement>(null);
  // the step being read is the last one whose heading has passed the top fifth of the screen
  useEffect(() => {
    const els = [...groups.flatMap((g) => g.stages.map((s) => s.id)), ...extra.map((e) => e.id)]
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => !!e);
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.2;
      let id: string | null = null;
      for (const e of els) if (e.getBoundingClientRect().top <= line) id = e.id;
      setCurrent(id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [groups, extra]);
  // keep the marked step visible inside the list, which scrolls on its own
  useEffect(() => {
    const nav = list.current;
    const a = current ? nav?.querySelector<HTMLElement>(`a[href="#${current}"]`) : null;
    if (!nav || !a || nav.offsetParent === null) return;
    const top = a.offsetTop - nav.offsetTop;
    if (top < nav.scrollTop || top + a.offsetHeight > nav.scrollTop + nav.clientHeight) nav.scrollTop = top - nav.clientHeight / 3;
  }, [current]);
  return (
    <div className="reader-side">
      <label className="reader-jump">
        <span className="sr-only">Jump to a step</span>
        <select
          className="h-11 w-full rounded-md border border-[#cfcabf] bg-white px-3 text-[15px]"
          value={current ?? ""}
          onChange={(e) => {
            const el = document.getElementById(e.target.value);
            if (!el) return;
            el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            history.replaceState(null, "", `#${e.target.value}`);
          }}
        >
          <option value="" disabled>
            Jump to a step
          </option>
          {groups.map((g) => (
            <optgroup key={g.id} label={g.title}>
              {g.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.title}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Results">
            {extra.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <nav className="reader-index" aria-label="Pipeline steps" ref={list}>
      {groups.map((g) => (
        <div key={g.id}>
          <p>{g.title}</p>
          {g.stages.map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={current === s.id ? "true" : undefined}>
              <span>{s.id}</span>
              <span>{s.title}</span>
            </a>
          ))}
        </div>
      ))}
      <p>Results</p>
      {extra.map((e) => (
        <a key={e.id} href={`#${e.id}`} aria-current={current === e.id ? "true" : undefined}>
          <span />
          <span>{e.title}</span>
        </a>
      ))}
      </nav>
    </div>
  );
}
