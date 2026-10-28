"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";

type Row = "volume" | "muted" | "reduceEffects" | "unlockAll";
const ROWS: Row[] = ["volume", "muted", "reduceEffects", "unlockAll"];
const BLOCKS = 10;

/** The arcade OPTIONS screen: ↑ ↓ to move, ← → or Enter to change, Esc to close. */
export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { volume, muted, reduceEffects, unlockAll, update } = useSettings();
  const [row, setRow] = useState(0);
  const level = Math.round(volume * BLOCKS);

  const setLevel = (n: number) => {
    const next = Math.max(0, Math.min(BLOCKS, n));
    if (next === level) return;
    update({ volume: next / BLOCKS });
    sfx.play("coin");
  };
  const flip = (key: Exclude<Row, "volume">) => {
    const values = { muted, reduceEffects, unlockAll };
    update({ [key]: !values[key] });
    sfx.play("tick");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const current = ROWS[row];
      if (e.key === "ArrowDown") setRow((r) => (r + 1) % ROWS.length);
      else if (e.key === "ArrowUp") setRow((r) => (r + ROWS.length - 1) % ROWS.length);
      else if (current === "volume" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        setLevel(level + (e.key === "ArrowRight" ? 1 : -1));
      } else if (current !== "volume" && ["ArrowLeft", "ArrowRight", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        flip(current);
      } else return;
      sfx.play("tick");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Modal open={open} onClose={onClose} label="Settings" className="max-w-lg">
      <div className="border-4 border-[#ffd319] bg-[#05060d] px-5 py-7 font-terminal text-paper shadow-[8px_8px_0_#ff2a6d] sm:px-8">
        <h2 className="arcade-logo text-center font-pixel text-2xl sm:text-3xl">OPTIONS</h2>
        <p className="mt-3 text-center text-lg text-[#4cc9f0]">↑ ↓ to choose · ← → to change</p>

        <ul className="mt-6 flex flex-col gap-2">
          <OptionRow active={row === 0} onHover={() => setRow(0)} label="Volume" note={muted ? "Muted" : `${level * 10}%`}>
            <div
              role="slider"
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={level * 10}
              tabIndex={0}
              className="flex items-center gap-1"
            >
              <PixelButton label="Volume down" onClick={() => setLevel(level - 1)}>−</PixelButton>
              {Array.from({ length: BLOCKS }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Volume ${(i + 1) * 10}%`}
                  onClick={() => setLevel(i + 1 === level ? i : i + 1)}
                  className={cn(
                    "h-6 w-3 sm:w-3.5",
                    i < level ? (muted ? "bg-paper/30" : "bg-[#3dd68c]") : "bg-[#1a2238]",
                  )}
                />
              ))}
              <PixelButton label="Volume up" onClick={() => setLevel(level + 1)}>+</PixelButton>
            </div>
          </OptionRow>
          <Toggle active={row === 1} onHover={() => setRow(1)} label="Mute all sound" note="Silence the rain, jazz and clicks" checked={muted} onChange={() => flip("muted")} />
          <Toggle active={row === 2} onHover={() => setRow(2)} label="Reduce effects" note="No rain, shake, flicker or typing" checked={reduceEffects} onChange={() => flip("reduceEffects")} />
          <Toggle active={row === 3} onHover={() => setRow(3)} label="Unlock all cases" note="Practice & demos: open every file" checked={unlockAll} onChange={() => flip("unlockAll")} />
        </ul>

        <button
          onClick={() => {
            sfx.play("pin");
            onClose();
          }}
          className="mt-8 w-full bg-[#ffd319] py-3 font-pixel text-sm text-[#05060d] shadow-[4px_4px_0_#ff2a6d] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
        >
          DONE
        </button>
      </div>
    </Modal>
  );
}

function OptionRow({ active, onHover, label, note, children }: {
  active: boolean;
  onHover: () => void;
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <li
      onMouseEnter={onHover}
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 transition-colors",
        active ? "bg-[#ffd319]/10" : "bg-transparent",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className={cn("pt-1 font-pixel text-xs text-[#ffd319]", active ? "animate-blink-hard" : "invisible")}>▶</span>
        <div className="min-w-0">
          <p className={cn("text-2xl leading-none", active ? "text-[#ffd319]" : "text-paper")}>{label}</p>
          <p className="mt-1 text-lg leading-none text-paper/55">{note}</p>
        </div>
      </div>
      {children}
    </li>
  );
}

function Toggle({ active, onHover, label, note, checked, onChange }: {
  active: boolean;
  onHover: () => void;
  label: string;
  note: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <OptionRow active={active} onHover={onHover} label={label} note={note}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={cn(
          "shrink-0 px-2 py-1.5 font-pixel text-[11px] transition-colors sm:text-xs",
          checked ? "bg-[#3dd68c] text-[#05060d]" : "bg-[#1a2238] text-paper/60 hover:text-paper",
        )}
      >
        {checked ? "[ ON ]" : "[OFF]"}
      </button>
    </OptionRow>
  );
}

function PixelButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center font-pixel text-xs text-paper/80 hover:text-[#ffd319]"
    >
      {children}
    </button>
  );
}
