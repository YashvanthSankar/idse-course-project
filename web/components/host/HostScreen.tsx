"use client";
import { BackButton } from "@/components/ui/BackButton";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listLevels } from "@/lib/api";
import { loadHostToken } from "@/lib/hostToken";
import { sfx } from "@/lib/sound";
import { useClock } from "@/lib/useClock";
import { useRoomSocket } from "@/lib/ws";
import { CountdownRing } from "./CountdownRing";
import { HostLobby } from "./HostLobby";
import { JoinPanel } from "./JoinPanel";
import { Leaderboard } from "./Leaderboard";
import { Podium } from "./Podium";
import { Ticker } from "./Ticker";

const noSubscribe = () => () => {};

export function HostScreen({ code }: { code: string }) {
  // null on the server render; "" in the browser when this tab didn't create the room.
  const token = useSyncExternalStore(noSubscribe, () => loadHostToken(code) ?? "", () => null);
  const { status, state, send } = useRoomSocket(code, "host", { token: token ?? undefined, enabled: Boolean(token) });
  const levels = useQuery({ queryKey: ["levels"], queryFn: listLevels });
  const [level, setLevel] = useState(1);
  const [minutes, setMinutes] = useState(6);
  const [roundSeconds, setRoundSeconds] = useState(360);
  const [setupAgain, setSetupAgain] = useState(false);
  const now = useClock();
  const endedRef = useRef<number | null>(null);

  // The projector ends the round when the clock runs out.
  useEffect(() => {
    if (state.phase !== "running" || !state.endsAt || now === null) return;
    if (now * 1000 >= state.endsAt && endedRef.current !== state.endsAt) {
      endedRef.current = state.endsAt;
      send({ type: "end" });
    }
  }, [now, state.phase, state.endsAt, send]);

  const start = () => {
    sfx.unlock();
    sfx.play("stamp");
    setRoundSeconds(minutes * 60);
    setSetupAgain(false);
    send({ type: "start", level, seconds: minutes * 60 });
  };

  if (token === "" || status === "forbidden") {
    return (
      <Shell code={code}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
          <p className="font-display text-4xl italic text-paper sm:text-5xl">This screen belongs to another session.</p>
          <p className="max-w-xl text-lg text-paper/70">
            Only the browser tab that created room {code} can run it. Start a new class session here instead.
          </p>
          <Link href="/host" className="mt-2 rounded-lg border-2 border-amber px-6 py-3 font-type tracking-[0.2em] text-amber hover:bg-amber/10">
            START A NEW CLASS SESSION
          </Link>
        </div>
      </Shell>
    );
  }

  if (status === "not_found") {
    return (
      <Shell code={code}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="font-display text-5xl italic text-paper">This room has closed.</p>
          <Link href="/host" className="text-xl text-amber underline">Open a new class session</Link>
        </div>
      </Shell>
    );
  }

  const caseTitle = levels.data?.find((l) => l.level === state.level)?.title;
  const view = state.phase === "running" ? "running" : state.phase === "ended" && !setupAgain ? "ended" : "lobby";

  return (
    <Shell code={code} connected={status === "open"}>
      {view === "lobby" && (
        <HostLobby
          code={code}
          players={state.players}
          level={level}
          minutes={minutes}
          onLevel={setLevel}
          onMinutes={setMinutes}
          onStart={start}
          canStart={status === "open" && state.players.length > 0}
        />
      )}

      {view === "running" && (
        <div className="grid flex-1 gap-6 px-4 pb-8 sm:gap-10 sm:px-10 sm:pb-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="min-w-0">
            <p className="text-lg text-paper/60">Case {String(state.level ?? "").padStart(2, "0")}</p>
            <h2 className="mb-6 font-display text-3xl font-black italic text-paper sm:text-5xl">{caseTitle ?? "In progress"}</h2>
            <Leaderboard rows={state.top} />
          </section>
          <section className="flex min-w-0 flex-col gap-6 sm:gap-8">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink-900/60 p-4 sm:gap-8 sm:p-6">
              {state.endsAt && <CountdownRing endsAt={state.endsAt} totalSeconds={roundSeconds} />}
              <div className="min-w-0 flex-1">
                <p className="text-lg text-paper/60">Cases closed</p>
                <p data-testid="solved-meter" className="font-mono text-3xl font-bold text-paper sm:text-5xl">
                  {state.solved}
                  <span className="text-paper/40"> / {state.total || state.players.length}</span>
                </p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-amber transition-[width] duration-700"
                    style={{ width: `${(state.total ? state.solved / state.total : 0) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-2xl border border-line bg-ink-900/60 p-4 sm:p-6">
              <p className="mb-4 text-lg text-paper/60">Live from the field</p>
              <Ticker lines={state.ticker} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <JoinPanel code={code} compact />
              <button
                data-testid="end-round"
                onClick={() => send({ type: "end" })}
                className="rounded-lg bg-red px-8 py-4 font-type text-xl tracking-[0.2em] text-white shadow-[0_0_30px_rgba(229,72,77,0.45)] hover:brightness-110"
              >
                END ROUND
              </button>
            </div>
          </section>
        </div>
      )}

      {view === "ended" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-12 px-10 pb-10">
          <h2 className="font-display text-6xl font-black italic text-paper">Top detectives</h2>
          <Podium rows={state.top} />
          <div className="flex gap-5">
            <Link
              href={`/host/${code}/autopsy`}
              data-testid="open-autopsy"
              className="rounded-lg bg-amber px-10 py-4 font-type text-2xl tracking-[0.2em] text-ink-950 hover:brightness-110"
            >
              OPEN CLASS AUTOPSY
            </Link>
            <button
              onClick={() => setSetupAgain(true)}
              className="rounded-lg border border-line px-8 py-4 font-type text-xl tracking-[0.15em] text-paper/80 hover:border-paper/50"
            >
              ANOTHER ROUND
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ code, connected = true, children }: { code: string; connected?: boolean; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_50%_-20%,#1b2540_0%,#07080b_65%)]">
      <header className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-4">
          <BackButton href="/host" label="Class Mode" short="Back" />
          <p className="font-display text-3xl font-black italic text-[#ffd9da] [text-shadow:0_0_14px_rgba(229,72,77,0.7)]">
            The Auditor
          </p>
        </div>
        <div className="flex items-center gap-4 text-lg text-paper/60">
          <span>Class Mode · Room {code}</span>
          <span
            title={connected ? "Connected" : "Reconnecting…"}
            className={`size-3 rounded-full ${connected ? "bg-green" : "animate-pulse bg-red"}`}
          />
        </div>
      </header>
      {children}
    </main>
  );
}
