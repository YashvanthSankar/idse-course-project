"use client";
import { BackButton } from "@/components/ui/BackButton";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listLevels, roomExists } from "@/lib/api";
import { loadHostToken } from "@/lib/hostToken";
import { sfx } from "@/lib/sound";
import { useClock } from "@/lib/useClock";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useRoomSocket } from "@/lib/ws";
import { CountdownRing } from "./CountdownRing";
import { HostLobby, ROUND_LENGTHS } from "./HostLobby";
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
  const [setupAgain, setSetupAgain] = useState(false);
  const now = useClock();
  const short = useMediaQuery("(max-height: 820px)") ?? false;
  const endedRef = useRef<number | null>(null);
  // Without the token we can't connect, so ask the API whether the room exists at all.
  const exists = useQuery({ queryKey: ["room-exists", code], queryFn: () => roomExists(code), enabled: token === "" });
  const roundSeconds = state.roundSeconds ?? minutes * 60;
  const overtime = state.phase === "running" && state.endsAt !== null && now !== null && now * 1000 >= state.endsAt;

  // The server ends the round after its grace period; the projector only steps in if that
  // message never arrives (late accusations sent at 0:00 must still count).
  useEffect(() => {
    if (state.phase !== "running" || !state.endsAt || now === null) return;
    if (now * 1000 >= state.endsAt + (state.grace + 3) * 1000 && endedRef.current !== state.endsAt) {
      endedRef.current = state.endsAt;
      send({ type: "end" });
    }
  }, [now, state.phase, state.endsAt, state.grace, send]);

  const start = () => {
    sfx.unlock();
    sfx.play("stamp");
    setSetupAgain(false);
    send({ type: "start", level, seconds: minutes * 60 });
  };

  const again = () => {
    // the next round starts from the last one's setup
    if (state.level) setLevel(Math.min(6, state.level));
    if (state.roundSeconds) {
      // the nearest preset (a 30 s test round still selects a button)
      const m = state.roundSeconds / 60;
      setMinutes(ROUND_LENGTHS.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best)));
    }
    setSetupAgain(true);
  };

  if (token === "" && exists.data === false) {
    return (
      <Shell code={code} connected={null}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
          <p className="font-display text-4xl italic text-paper sm:text-5xl">There&apos;s no room {code}.</p>
          <p className="max-w-xl text-lg text-paper/70">It may have closed, or the code has a typo.</p>
          <Link href="/host" className="mt-2 rounded-lg border-2 border-amber px-6 py-3 font-type tracking-[0.2em] text-amber hover:bg-amber/10">
            START A NEW CLASS SESSION
          </Link>
        </div>
      </Shell>
    );
  }

  if (token === "" || status === "forbidden") {
    return (
      <Shell code={code} connected={null}>
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
      <Shell code={code} connected={null}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
          <p className="font-display text-4xl italic text-paper sm:text-5xl">This room has closed.</p>
          <Link href="/host" className="text-xl text-amber underline">Open a new class session</Link>
        </div>
      </Shell>
    );
  }

  const caseTitle = levels.data?.find((l) => l.level === state.level)?.title;
  const view = state.phase === "running" ? "running" : state.phase === "ended" && !setupAgain ? "ended" : "lobby";

  return (
    <Shell code={code} connected={status === "open"} fit={view === "running"}>
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
          offline={status !== "open" && status !== "connecting"}
        />
      )}

      {view === "running" && (
        <div className="grid flex-1 gap-6 px-4 pb-8 sm:gap-10 sm:px-10 sm:pb-10 lg:min-h-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] short:gap-5 short:pb-5">
          {/* a full top 10 scrolls inside its column, so END ROUND never drops below the fold */}
          <section className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:[mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
            <p className="text-xl text-paper/70">Case {String(state.level ?? "").padStart(2, "0")}</p>
            <h2 className="mb-6 font-display text-3xl font-black italic text-paper sm:text-5xl short:mb-3 short:sm:text-4xl">{caseTitle ?? "In progress"}</h2>
            <Leaderboard rows={state.top} />
          </section>
          <section className="flex min-w-0 flex-col gap-6 sm:gap-8 lg:min-h-0 short:sm:gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-ink-900/60 p-4 sm:gap-8 sm:p-6 short:sm:p-4">
              {state.endsAt && <CountdownRing endsAt={state.endsAt} totalSeconds={roundSeconds} size={short ? 112 : 150} />}
              <div className="min-w-0 flex-1">
                {overtime ? (
                  <p className="text-lg text-amber" data-testid="grace">
                    Time! Last accusations still count for {Math.max(0, Math.ceil((state.endsAt ?? 0) / 1000 + state.grace - (now ?? 0)))} s.
                  </p>
                ) : state.total > 0 && state.solved === state.total ? (
                  <p className="text-lg text-green" data-testid="all-done">Everyone&apos;s done. End the round when you&apos;re ready.</p>
                ) : (
                  <p className="text-xl text-paper/70">Cases closed</p>
                )}
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
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-ink-900/60 p-4 sm:p-6 short:sm:p-4">
              <p className="mb-4 text-xl text-paper/70 short:mb-2">Live from the field</p>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-8 sm:px-10 lg:gap-12 short:gap-5 short:pb-5">
          <h2 className="font-display text-4xl font-black italic text-paper sm:text-6xl short:sm:text-5xl">Top detectives</h2>
          <Podium rows={state.top} />
          <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
            <Link
              href={`/host/${code}/autopsy`}
              data-testid="open-autopsy"
              className="rounded-lg bg-amber px-6 py-4 font-type text-xl tracking-[0.2em] text-ink-950 hover:brightness-110 sm:px-10 sm:text-2xl"
            >
              OPEN CLASS AUTOPSY
            </Link>
            <button
              onClick={again}
              className="rounded-lg border border-line px-6 py-4 font-type text-xl tracking-[0.15em] text-paper/80 hover:border-paper/50 sm:px-8"
            >
              ANOTHER ROUND
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** `connected`: true / false for a live socket, null when there is none to show. */
function Shell({ code, connected, fit = false, children }: { code: string; connected: boolean | null; fit?: boolean; children: React.ReactNode }) {
  return (
    <main className={`flex min-h-dvh flex-col overflow-x-clip ${fit ? "lg:h-dvh lg:overflow-hidden" : ""} bg-[radial-gradient(ellipse_at_50%_-20%,#1b2540_0%,#07080b_65%)]`}>
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-10 sm:py-6 short:sm:py-3">
        <div className="flex items-center gap-4">
          <BackButton href="/host" label="Class Mode" short="Back" />
          <p className="arcade-logo hidden font-pixel text-xl sm:block">
            OUTLIER
          </p>
        </div>
        <div className="flex items-center gap-3 text-right text-base text-paper/70 sm:gap-4 sm:text-xl">
          <span className="whitespace-nowrap"><span className="hidden sm:inline">Class Mode · </span>Room {code}</span>
          {connected === false && <span className="text-red" role="status">Reconnecting…</span>}
          {connected !== null && (
            <span
              title={connected ? "Connected" : "Reconnecting…"}
              className={`size-3 rounded-full ${connected ? "bg-green" : "animate-pulse bg-red"}`}
            />
          )}
        </div>
      </header>
      {children}
    </main>
  );
}
