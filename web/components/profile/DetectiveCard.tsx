"use client";
import { BackButton } from "@/components/ui/BackButton";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import Link from "next/link";
import { useRef, useState } from "react";
import { PlotlyChart } from "@/components/case/PlotlyChart";
import { ApiError, getCareer, getProfile } from "@/lib/api";
import { loadCareerCode } from "@/lib/career";
import { sfx } from "@/lib/sound";
import type { Profile } from "@/lib/types";

const ICON: Record<string, string> = {
  "The Statistician": "σ",
  "The Gambler": "♠",
  "The Hacker": "</>",
  "The Visualizer": "◐",
};

/** Shrink the radar inside its box so every axis label fits. */
function roomyRadar(figure: { layout?: Record<string, unknown> }) {
  const polar = (figure.layout?.polar ?? {}) as Record<string, unknown>;
  return { ...figure, layout: { ...figure.layout, polar: { ...polar, domain: { x: [0.22, 0.78], y: [0.12, 0.88] } } } };
}

export function DetectiveCardPage({ playerId }: { playerId: string }) {
  const profile = useQuery({
    queryKey: ["profile", playerId],
    queryFn: () => getProfile(playerId),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_at_50%_0%,#1b2540_0%,#07080b_70%)] px-4 py-16">
      <BackButton href="/" label="Menu" className="absolute left-4 top-4" />
      {profile.isPending && <p className="text-xl text-paper/60">Pulling your file…</p>}
      {profile.isError && (
        <div className="max-w-sm text-center">
          {profile.error instanceof ApiError && profile.error.status === 404 ? (
            <>
              <p className="font-display text-4xl italic text-paper">No file on this detective yet.</p>
              <p className="mt-3 text-lg text-paper/60">Play a case first — then come back for your card.</p>
            </>
          ) : (
            <>
              <p className="font-display text-4xl italic text-paper">Can&apos;t reach the records room.</p>
              <p className="mt-3 text-lg text-paper/60">Check the Wi-Fi and try again.</p>
              <button onClick={() => profile.refetch()} className="mt-6 min-h-11 rounded-lg border border-amber/60 px-5 text-amber">
                TRY AGAIN
              </button>
            </>
          )}
        </div>
      )}
      {profile.data && <Card profile={profile.data} />}
    </main>
  );
}

function Card({ profile }: { profile: Profile }) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  // Career Mode adds only its title to the card; company and salary live on the Career hub
  const [code] = useState(() => (typeof window === "undefined" ? null : loadCareerCode()));
  const career = useQuery({ queryKey: ["career", code], queryFn: () => getCareer(code!), enabled: Boolean(code), retry: false });
  const title = career.data?.title;
  const s = profile.stats;
  const stats = [
    ["Tools run", String(s.n_tools ?? 0)],
    ["Different tools", String(s.distinct_tools ?? 0)],
    ["Verdict", s.correct ? "Caught them" : "Missed"],
    ["Score", Math.round(s.score ?? 0).toLocaleString()],
  ];

  const save = async () => {
    if (!ref.current) return;
    setSaving(true);
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: "#07080b" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `detective-${profile.name.replace(/\W+/g, "-").toLowerCase() || "card"}.png`;
      a.click();
      sfx.play("stamp");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        ref={ref}
        data-testid="detective-card"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--fx", `${((e.clientX - r.left) / r.width) * 100}%`);
          e.currentTarget.style.setProperty("--fy", `${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        className="group tex-paper relative w-full max-w-[380px] overflow-hidden rounded-2xl border-[6px] border-[#2a2418] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
      >
        {/* foil shimmer that follows the pointer */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 mix-blend-color-dodge transition-opacity duration-300 group-hover:opacity-45"
          style={{
            background:
              "radial-gradient(circle at var(--fx,50%) var(--fy,50%), rgba(255,255,255,0.55), transparent 40%), linear-gradient(115deg, transparent 20%, rgba(76,201,240,0.35) 35%, rgba(245,165,36,0.35) 50%, rgba(229,72,77,0.3) 65%, transparent 80%)",
          }}
        />
        <div className="flex items-center justify-between text-xs font-semibold tracking-[0.25em] opacity-60">
          <span>OUTLIER</span>
          <span>DETECTIVE CARD</span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-[#2a2418] font-display text-3xl font-black">
            {ICON[profile.archetype] ?? "?"}
          </span>
          <div className="min-w-0">
            <p data-testid="archetype" className="break-words font-display text-2xl font-black italic leading-tight sm:text-3xl">
              {profile.archetype}
            </p>
            <p className="truncate text-lg">{profile.name}</p>
            {title && (
              <p data-testid="career-title" className="mt-0.5 font-type text-xs tracking-[0.3em] text-[#8f1d27]">
                {title.toUpperCase()}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-base italic opacity-80">“{profile.tagline}”</p>
        <div className="mt-4 rounded-xl bg-ink-950 p-2">
          <PlotlyChart figure={roomyRadar(profile.radar_figure)} height={250} compact />
          <p className="pb-1 text-center text-xs text-paper/50">amber = you · grey = class average</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[#2a2418]/25 bg-black/5 px-3 py-2">
              <dt className="text-xs opacity-60">{label}</dt>
              <dd className="whitespace-nowrap font-mono text-lg font-bold sm:text-xl">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-amber px-6 py-3 font-type tracking-[0.2em] text-ink-950 disabled:opacity-50"
        >
          {saving ? "DEVELOPING…" : "SAVE AS PNG"}
        </button>
        <Link href="/" className="rounded-lg border border-line px-6 py-3 font-type tracking-[0.2em] text-paper/80">
          HOME
        </Link>
      </div>
    </>
  );
}
