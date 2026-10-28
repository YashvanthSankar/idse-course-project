"use client";
import { BackButton } from "@/components/ui/BackButton";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { roomExists } from "@/lib/api";
import { InvestigationScreen } from "@/components/case/InvestigationScreen";
import { rememberRoomCase } from "@/lib/roomCase";
import { getPlayerSnapshot, loadPlayer, MAX_NAME, setPlayerName, subscribePlayer } from "@/lib/player";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import { useRoomSocket } from "@/lib/ws";

function usePlayer() {
  const raw = useSyncExternalStore(subscribePlayer, getPlayerSnapshot, () => null);
  return useMemo(() => {
    if (raw === null) return null; // server render
    try {
      return raw ? (JSON.parse(raw) as { id: string; name: string }) : loadPlayer();
    } catch {
      return loadPlayer();
    }
  }, [raw]);
}

export function PlayScreen({ code }: { code: string }) {
  const me = usePlayer();
  // Check the room before asking for a name: a typo should be caught at the door.
  const room = useQuery({ queryKey: ["room-exists", code], queryFn: () => roomExists(code), retry: 1 });
  if (me === null || room.isPending) return <Centered><p className="text-paper/60">Opening the case file…</p></Centered>;
  if (room.data === false) return <NoSuchRoom code={code} />;
  if (!me.name) return <NameForm code={code} />;
  return <Joined code={code} playerId={me.id} name={me.name} />;
}

function NameForm({ code }: { code: string }) {
  const [name, setName] = useState("");
  return (
    <Centered>
      <p className="text-lg text-paper/60">Room {code}</p>
      <h1 className="mt-2 font-display text-5xl font-black italic text-paper">Who&apos;s on the case?</h1>
      <form
        className="mt-10 w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          sfx.unlock();
          sfx.play("stamp");
          setPlayerName(name);
        }}
      >
        <input
          autoFocus
          value={name}
          maxLength={MAX_NAME}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your detective name"
          aria-label="Your detective name"
          className="w-full rounded-lg border border-line bg-ink-900 px-5 py-4 text-center text-2xl text-paper placeholder:text-paper/30 focus:border-amber focus:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full rounded-lg bg-amber py-4 font-type text-xl tracking-[0.25em] text-ink-950 disabled:opacity-40"
        >
          JOIN THE INVESTIGATION
        </button>
      </form>
    </Centered>
  );
}

function Joined({ code, playerId, name }: { code: string; playerId: string; name: string }) {
  const { status, state } = useRoomSocket(code, "player", { playerId, name });
  const closed = useCaseStore((s) => Boolean(s.verdict) && s.meta?.case_id === state.caseId);

  useEffect(() => {
    if (state.caseId) rememberRoomCase(state.caseId, code);
  }, [state.caseId, code]);

  if (status === "not_found") return <NoSuchRoom code={code} />;

  if (state.phase === "ended") {
    return (
      <Centered>
        <p className="font-display text-4xl italic text-paper">Round over.</p>
        <p className="mt-3 text-lg text-paper/70">Look up at the big screen for the podium.</p>
        <ProfileLink playerId={playerId} />
      </Centered>
    );
  }

  if (state.caseId && !closed) {
    return (
      <div data-testid="play-case" data-case-id={state.caseId}>
        <InvestigationScreen caseId={state.caseId} redirectWhenClosed={false} />
      </div>
    );
  }

  return (
    <Centered>
      <span className="relative mb-8 flex size-5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber opacity-60" />
        <span className="relative inline-flex size-5 rounded-full bg-amber" />
      </span>
      <p data-testid="play-lobby" className="font-display text-4xl font-black italic text-paper">
        {closed ? "Case closed." : `You're in, ${name}.`}
      </p>
      <p className="mt-4 text-xl text-paper/70">
        {closed ? "Waiting for the round to end." : "Look up at the big screen."}
      </p>
      {status !== "open" && <p className="mt-6 text-sm text-red">Reconnecting…</p>}
      {closed && <ProfileLink playerId={playerId} />}
    </Centered>
  );
}

function ProfileLink({ playerId }: { playerId: string }) {
  return (
    <Link
      href={`/profile/${playerId}`}
      className="mt-10 rounded-lg border border-amber/60 px-6 py-3 font-type tracking-[0.2em] text-amber"
    >
      SEE YOUR DETECTIVE CARD
    </Link>
  );
}

function NoSuchRoom({ code }: { code: string }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  return (
    <Centered>
      <p className="text-lg text-paper/60">Room {code}</p>
      <h1 className="mt-2 font-display text-4xl font-black italic text-paper">No such room.</h1>
      <p className="mt-3 text-lg text-paper/70">Check the code on the big screen and try again.</p>
      <form
        className="mt-8 w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (next.length === 4) router.push(`/play/${next}`);
        }}
      >
        <input
          value={next}
          maxLength={4}
          autoCapitalize="characters"
          onChange={(e) => setNext(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          placeholder="ABCD"
          aria-label="Room code"
          className="w-full rounded-lg border border-line bg-ink-900 px-5 py-4 text-center font-mono text-3xl tracking-[0.5em] text-amber placeholder:text-paper/20 focus:border-amber focus:outline-none"
        />
        <button
          type="submit"
          disabled={next.length !== 4}
          className="w-full rounded-lg bg-amber py-4 font-type text-xl tracking-[0.25em] text-ink-950 disabled:opacity-40"
        >
          TRY THIS ROOM
        </button>
      </form>
      <Link href="/" className="mt-8 inline-block py-2 text-amber underline">Back to the title screen</Link>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_0%,#1b2540_0%,#07080b_70%)] px-6 text-center">
      <BackButton href="/" label="Menu" className="absolute left-4 top-4" />
      <div className="flex w-full max-w-sm flex-col items-center">{children}</div>
    </main>
  );
}
