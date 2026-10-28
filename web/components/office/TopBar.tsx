"use client";
import Link from "next/link";
import { useState } from "react";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { BackButton } from "@/components/ui/BackButton";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";

export function TopBar() {
  const muted = useSettings((s) => s.muted);
  const update = useSettings((s) => s.update);
  const [settings, setSettings] = useState(false);

  return (
    <header className="relative z-20 flex items-center justify-between gap-3 border-b border-black/60 bg-[#0d0906]/85 px-4 py-2.5 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
      <BackButton href="/" label="Menu" />
      <Link href="/" className="group flex items-center gap-3" onClick={() => sfx.play("tick")}>
        <span className="font-display text-xl font-black italic text-[#ffd9da] [text-shadow:0_0_10px_rgba(229,72,77,0.8)]">
          Outlier
        </span>
        <span className="hidden font-type text-[10px] tracking-[0.35em] text-muted sm:inline">
          BUREAU OF FORENSIC AUDIT · MUMBAI
        </span>
      </Link>
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
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}
