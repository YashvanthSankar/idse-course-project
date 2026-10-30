"use client";
import { QRCodeSVG } from "qrcode.react";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Where phones should go. Read from the browser, so it matches the URL the projector uses. */
function useOrigin() {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}

export function JoinPanel({ code, compact = false }: { code: string; compact?: boolean }) {
  const origin = useOrigin();
  const url = `${origin}/play/${code}`;
  if (compact) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-line bg-ink-900/80 px-4 py-3">
        {origin && <QRCodeSVG value={url} size={72} bgColor="#efe6d2" fgColor="#07080b" includeMargin />}
        <div>
          <p className="text-base text-paper/70">Late? Join with code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.2em] text-amber">{code}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-xl text-paper/70">Scan to join on your phone</p>
      <div className="mt-5 rounded-xl bg-paper p-4 shadow-[0_0_60px_rgba(245,165,36,0.15)]">
        {origin ? (
          <QRCodeSVG
            value={url}
            size={280}
            bgColor="#efe6d2"
            fgColor="#07080b"
            data-testid="join-qr"
            style={{ width: "min(280px, 62vw, 32vh)", height: "auto" }}
          />
        ) : (
          <div className="aspect-square w-[min(280px,62vw,32vh)]" />
        )}
      </div>
      <p className="mt-4 break-all font-mono text-base text-paper/60 sm:text-lg">{url.replace(/^https?:\/\//, "")}</p>
      <p className="mt-8 text-lg text-paper/60 short:mt-3">Room code</p>
      <p
        data-testid="room-code"
        className="font-display text-[clamp(56px,min(9vw,14vh),168px)] font-black leading-none tracking-[0.08em] text-amber [text-shadow:0_0_40px_rgba(245,165,36,0.35)]"
      >
        {code}
      </p>
    </div>
  );
}
