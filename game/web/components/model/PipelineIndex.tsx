"use client";
import { useEffect, useState } from "react";

type Group = { id: string; title: string; stages: { id: string; title: string }[] };

/** The list of steps beside the notebook; the step being read is marked. */
export function PipelineIndex({ groups, extra }: { groups: Group[]; extra: { id: string; title: string }[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    const ids = [...groups.flatMap((g) => g.stages.map((s) => s.id)), ...extra.map((e) => e.id)];
    const seen = new Observer(ids, setCurrent);
    return () => seen.stop();
  }, [groups, extra]);
  return (
    <nav className="reader-index" aria-label="Pipeline steps">
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
  );
}

class Observer {
  private io: IntersectionObserver;
  constructor(ids: string[], onChange: (id: string) => void) {
    this.io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) onChange(visible.target.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) this.io.observe(el);
    });
  }
  stop() {
    this.io.disconnect();
  }
}
