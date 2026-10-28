"use client";
import { Modal } from "@/components/ui/Modal";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { volume, muted, reduceEffects, unlockAll, update } = useSettings();
  return (
    <Modal open={open} onClose={onClose} label="Settings" className="max-w-md">
      <div className="rounded-lg border border-line bg-ink-900 p-6 shadow-2xl">
        <h2 className="mb-6 font-display text-3xl italic text-amber">Settings</h2>
        <label className="mb-5 block">
          <span className="mb-2 flex justify-between text-sm text-muted">
            <span>Volume</span>
            <span className="font-mono">{Math.round(volume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
            onPointerUp={() => sfx.play("coin")}
            className="w-full accent-amber"
          />
        </label>
        <Toggle label="Mute all sound" checked={muted} onChange={(v) => update({ muted: v })} />
        <Toggle
          label="Reduce effects (no rain, shake or typing)"
          checked={reduceEffects}
          onChange={(v) => update({ reduceEffects: v })}
        />
        <Toggle
          label="Unlock all cases (practice & demos)"
          checked={unlockAll}
          onChange={(v) => update({ unlockAll: v })}
        />
        <button
          onClick={onClose}
          className="mt-6 w-full rounded border border-amber/60 py-2 font-type tracking-widest text-amber hover:bg-amber/10"
        >
          DONE
        </button>
      </div>
    </Modal>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-4 flex cursor-pointer items-center justify-between gap-4 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => {
          onChange(!checked);
          sfx.play("tick");
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-amber" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink-950 transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}
