"use client";
import Link from "next/link";
import { useState } from "react";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { BackButton } from "@/components/ui/BackButton";
import { totalScore } from "@/lib/progress";
import { rankFor } from "@/lib/rank";
import { useSettings } from "@/lib/settings";
import { useProgress } from "@/lib/useProgress";
import { sfx } from "@/lib/sound";

export function TopBar() {
  const muted = useSettings((s) => s.muted);
  const update = useSettings((s) => s.update);
  const [settings, setSettings] = useState(false);
  const total = totalScore(useProgress());
  const rank = rankFor(total);

  return (
    <header className="relative z-20 flex items-center justify-between gap-3 border-b border-black/60 bg-[#0d0906]/85 px-4 py-2.5 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
      <BackButton href="/" label="Menu" />
      <Link href="/" className="group flex items-center gap-3" onClick={() => sfx.play("tick")}>
        <span className="arcade-logo font-pixel text-sm">
          OUTLIER
        </span>
        <span className="hidden font-type text-[10px] tracking-[0.35em] text-muted sm:inline">
          BUREAU OF FORENSIC AUDIT · MUMBAI
        </span>
      </Link>
      </div>
      <div className="flex items-center gap-3">
        <div data-testid="rank" className="hidden min-w-40 sm:block" title={rank.next ? `${rank.toNext.toLocaleString("en-IN")} points to ${rank.next}` : "Top rank"}>
          <p className="flex justify-between gap-3 font-pixel text-[9px]">
            <span className="text-[#ffd319]">{rank.title.toUpperCase()}</span>
            <span className="text-paper/50">{total.toLocaleString("en-IN")} PTS</span>
          </p>
          <div className="mt-1 h-1.5 bg-[#1a2238]">
            <div className="h-full bg-[#3dd68c] transition-[width] duration-700" style={{ width: `${Math.round(rank.progress * 100)}%` }} />
          </div>
          <p className="mt-0.5 font-terminal text-[15px] leading-none text-paper/50">
            {rank.next ? `${rank.toNext.toLocaleString("en-IN")} to ${rank.next}` : "Top of the bureau"}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => {
            update({ muted: !muted });
            if (muted) sfx.play("tick");
          }}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          className="rounded border border-line px-2.5 py-1 font-mono text-xs text-muted hover:border-amber hover:text-amber"
        >
          {muted ? "♪ OFF" : "♪ ON"}
        </button>
        <button
          onClick={() => setSettings(true)}
          aria-label="Settings"
          className="rounded border border-line px-2.5 py-1 font-mono text-xs text-muted hover:border-amber hover:text-amber"
        >
          ⚙
        </button>
        </div>
      </div>
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}
