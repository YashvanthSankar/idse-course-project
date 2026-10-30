"use client";
import { useClock } from "@/lib/useClock";

export function CountdownRing({ endsAt, totalSeconds, size = 150 }: { endsAt: number; totalSeconds: number; size?: number }) {
  const now = useClock();
  const left = now === null ? totalSeconds : Math.max(0, Math.round(endsAt / 1000 - now));
  const fraction = totalSeconds > 0 ? Math.min(1, left / totalSeconds) : 0;
  const r = size / 2 - 10;
  const circumference = 2 * Math.PI * r;
  const urgent = left <= 30;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="countdown">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "var(--red)" : "var(--amber)"}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-mono text-4xl font-bold ${urgent ? "text-red" : "text-paper"}`}
      >
        {mm}:{ss}
      </span>
    </div>
  );
}
