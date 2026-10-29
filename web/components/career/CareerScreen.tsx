"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BriefingModal } from "@/components/case/BriefingModal";
import { LampLight } from "@/components/fx/LampLight";
import { TopBar } from "@/components/office/TopBar";
import { ApiError, createCareer, getCareer, getEnding, openCareerCase, retireCareer, signContract } from "@/lib/api";
import {
  BAND_LABEL,
  BAND_STYLE,
  DIFFICULTY_LABEL,
  appraisalSeen,
  careerCodeSnapshot,
  formatSalary,
  markAppraisalSeen,
  saveCareerCode,
  subscribeCareerCode,
} from "@/lib/career";
import { cn } from "@/lib/cn";
import { loadPlayer } from "@/lib/player";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import type { Appraisal, CareerView, CaseMeta } from "@/lib/types";
import { AppraisalModal, GreetingsModal, History, NotesModal, OfferLetter, TierChip } from "./CareerParts";
import { Cutscene } from "./Cutscene";
import { Prologue } from "./Prologue";

/** /career: the prologue for a new player, the hub for everyone else. */
export function CareerScreen() {
  // localStorage is client-only: the server renders nothing, the client the saved career
  const stored = useSyncExternalStore(subscribeCareerCode, careerCodeSnapshot, () => undefined);
  const code = stored === undefined ? undefined : stored || null;
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const setCode = (next: string | null) => saveCareerCode(next);

  const start = useMutation({
    mutationFn: () => createCareer(loadPlayer().id),
    onSuccess: (view) => {
      client.setQueryData(["career", view.code], view);
      setCode(view.code);
    },
    onError: (err) => setError(`The Bureau's phone is dead (${err.message}). Is the Python brain running?`),
  });

  const useCode = async (typed: string) => {
    setError(null);
    try {
      const view = await getCareer(typed);
      client.setQueryData(["career", view.code], view);
      setCode(view.code);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "No career with that code." : "Couldn't reach the Bureau.");
    }
  };

  if (code === undefined) return <div className="min-h-dvh bg-[#05060d]" />;
  if (code === null) {
    return <Prologue onStart={() => start.mutate()} onContinue={useCode} starting={start.isPending} error={error} />;
  }
  return (
    <Hub
      code={code}
      onLeave={() => setCode(null)}
      onSwitch={(next) => {
        client.setQueryData(["career", next.code], next);
        setCode(next.code);
      }}
    />
  );
}

function Hub({ code, onLeave, onSwitch }: { code: string; onLeave: () => void; onSwitch: (view: CareerView) => void }) {
  const router = useRouter();
  const client = useQueryClient();
  const career = useQuery({ queryKey: ["career", code], queryFn: () => getCareer(code), retry: 1 });
  const [briefing, setBriefing] = useState<CaseMeta | null>(null);
  const [greetingsFor, setGreetingsFor] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [dayOne, setDayOne] = useState(false); // just signed: the greetings, then the notes
  const [appraisal, setAppraisal] = useState<Appraisal | null>(null);
  const [ending, setEnding] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const view = career.data;

  const update = (next: CareerView) => client.setQueryData(["career", next.code], next);

  const sign = useMutation({
    mutationFn: ({ id, practice }: { id: string; practice: boolean }) => signContract(code, id, practice),
    onSuccess: (next) => {
      update(next);
      setDayOne(true);
      if (next.contract && next.contract.greetings.length > 0) setGreetingsFor(`${next.code}:${next.history.length}`);
      else if (next.contract?.senior) setNotesOpen(true);
    },
  });
  const open = useMutation({
    mutationFn: () => openCareerCase(code),
    onSuccess: (meta) => {
      sfx.play("whoosh");
      setBriefing(meta);
    },
  });
  const retire = useMutation({
    mutationFn: () => retireCareer(code),
    onSuccess: (fresh) => {
      setConfirmRetire(false);
      onSwitch(fresh);
    },
  });
  const scene = useQuery({ queryKey: ["ending", code], queryFn: () => getEnding(code), enabled: ending });

  useEffect(() => {
    sfx.loop("rain");
    sfx.loop("jazz");
  }, []);

  // A finished contract's appraisal pops up once, the first time the hub sees it
  useEffect(() => {
    if (!view || view.history.length === 0) return;
    const i = view.history.length - 1;
    if (appraisalSeen(view.code, i)) return;
    const timer = window.setTimeout(() => {
      markAppraisalSeen(view.code, i);
      const last = view.history[i];
      if (last.tier === "final") setEnding(true);
      else setAppraisal(last);
    }, 400); // let the desk settle first
    return () => window.clearTimeout(timer);
  }, [view]);

  if (career.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-950 p-6 text-center">
        <p className="font-display text-3xl italic text-paper">This career file is missing.</p>
        <p className="max-w-sm text-lg text-paper/60">Code {code} wasn&apos;t found, or the Bureau is offline.</p>
        <div className="flex gap-3">
          <button onClick={() => career.refetch()} className="min-h-11 border border-line px-5 text-paper/80 hover:text-amber">Try again</button>
          <button onClick={onLeave} className="min-h-11 border border-amber px-5 text-amber">Start or enter another career</button>
        </div>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <p className="animate-blink font-type tracking-[0.4em] text-amber">PULLING YOUR FILE…</p>
      </div>
    );
  }

  const contract = view.contract;
  const next = contract?.cases.find((c) => c.rating === null);
  const ended = view.status === "ended";
  const practiceList = ended || !contract ? view.worked_at : [];
  const greetingsOpen = contract !== null && greetingsFor === `${view.code}:${view.history.length}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-ink-950">
      <TopBar />
      <main className="tex-desk relative flex-1 px-4 pb-20 pt-6 sm:px-8">
        <div className="relative mx-auto max-w-5xl">
          {/* who you are now */}
          <section aria-label="Your career" className="flex flex-wrap items-end justify-between gap-4 border-b border-line/70 pb-5">
            <div>
              <p className="font-type text-[11px] tracking-[0.4em] text-amber/80">YEAR {view.year} · CAREER {view.code}</p>
              <h1 className="mt-1 font-display text-4xl italic text-paper sm:text-5xl">{view.title ?? "Forensic Auditor"}</h1>
              <p className="mt-2 max-w-xl text-lg text-paper/75" data-testid="career-goal">{view.goal}</p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted">Salary</p>
                <p className="font-display text-3xl italic text-paper" data-testid="career-salary">{formatSalary(view.salary)}</p>
              </div>
              <TierChip tier={view.tier} name={view.tier_name} />
            </div>
          </section>

          {ended && (
            <section className="mt-8 rounded-sm border border-amber/50 bg-amber/5 p-5 text-center" data-testid="story-over">
              <p className="font-type text-xs tracking-[0.4em] text-amber">THE STORY IS OVER</p>
              <p className="mt-2 font-display text-2xl italic text-paper">
                {view.ending === "caught" ? "You caught them. The Commission made you Chief Auditor." : "They got away. The Commission let you go, quietly."}
              </p>
              <button onClick={() => setEnding(true)} className="mt-4 min-h-11 border border-amber px-5 font-type tracking-[0.2em] text-amber hover:bg-amber/10">
                ▶ REPLAY THE ENDING
              </button>
            </section>
          )}

          {contract && (
            <section aria-label="Your contract" className="mt-8" data-testid="contract">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-type text-[11px] tracking-[0.4em] text-paper/60">
                    {contract.practice ? "PRACTICE" : `CONTRACT · YEAR ${contract.year}`}
                  </p>
                  <h2 className="font-display text-3xl italic text-paper">{contract.company.name}</h2>
                  <p className="text-sm text-muted">{contract.company.city} · {contract.company.culture_note}</p>
                </div>
                <div className="flex flex-wrap gap-x-5">
                  {contract.senior && (
                    <button onClick={() => setNotesOpen(true)} data-testid="open-notes" className="min-h-11 text-sm text-amber underline-offset-4 hover:underline">
                      📒 Notes from {contract.senior.name.split(" ")[0]}
                    </button>
                  )}
                  {contract.greetings.length > 0 && (
                    <button onClick={() => setGreetingsFor(`${view.code}:${view.history.length}`)} className="min-h-11 text-sm text-cyan underline-offset-4 hover:underline">
                      Familiar faces ({contract.greetings.length})
                    </button>
                  )}
                </div>
              </div>
              <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {contract.cases.map((c) => (
                  <li
                    key={c.index}
                    data-testid="case-slot"
                    className={cn(
                      "rounded-sm border p-3",
                      c === next ? "border-amber bg-amber/10" : c.rating !== null ? "border-line bg-ink-900/80" : "border-line/50 bg-ink-900/40 opacity-70",
                    )}
                  >
                    <p className="font-pixel text-[9px] text-paper/60">CASE {c.index}</p>
                    <p className="text-sm text-paper/80">{DIFFICULTY_LABEL[c.difficulty]}</p>
                    <p className="mt-1 font-display text-2xl italic text-paper">
                      {c.rating !== null ? Math.round(c.rating) : "—"}
                      {c.correct !== null && <span className={cn("ml-2 text-base not-italic", c.correct ? "text-green" : "text-red")}>{c.correct ? "✓" : "✗"}</span>}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <p className="text-paper/75">
                  {contract.average !== null && contract.band_so_far ? (
                    <>
                      Average so far <span className="font-bold text-paper">{contract.average}</span>{" "}
                      <span className={cn("ml-1 rounded-sm border px-2 py-0.5 text-xs", BAND_STYLE[contract.band_so_far])}>{BAND_LABEL[contract.band_so_far]}</span>
                    </>
                  ) : (
                    "88+ is Exceptional (and you must solve the hard case) · 70+ Good · 60+ OK."
                  )}
                </p>
                {next && (
                  <button
                    onClick={() => open.mutate()}
                    disabled={open.isPending}
                    data-testid="open-case"
                    className="min-h-11 bg-[#ffd319] px-7 py-3 font-pixel text-xs text-[#05060d] shadow-[4px_4px_0_#ff2a6d] disabled:opacity-60"
                  >
                    {open.isPending ? "PULLING THE FILE…" : `${next.case_id ? "CONTINUE" : "OPEN"} CASE ${next.index} ▶`}
                  </button>
                )}
              </div>
              {open.isError && <p role="alert" className="mt-3 text-red">{open.error.message}</p>}
            </section>
          )}

          {!contract && !ended && (
            <section aria-label="Offers" className="mt-8">
              <h2 className="mb-4 font-type text-xs tracking-[0.45em] text-paper/70">OFFERS ON YOUR DESK</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {view.offers.map((company, i) => (
                  <OfferLetter
                    key={company.id}
                    company={company}
                    index={i}
                    signing={sign.isPending && sign.variables?.id === company.id}
                    onSign={() => sign.mutate({ id: company.id, practice: false })}
                  />
                ))}
              </div>
              {sign.isError && <p role="alert" className="mt-3 text-red">{sign.error.message}</p>}
            </section>
          )}

          {practiceList.length > 0 && (
            <section aria-label="Practice" className="mt-12">
              <h2 className="mb-1 font-type text-xs tracking-[0.45em] text-paper/70">PRACTICE</h2>
              <p className="mb-4 text-paper/55">Replay any company you&apos;ve worked for. Recorded, but no raise and no promotion credit.</p>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {practiceList.map((company, i) => (
                  <OfferLetter
                    key={company.id}
                    company={company}
                    index={i}
                    practice
                    signing={sign.isPending && sign.variables?.id === company.id}
                    onSign={() => sign.mutate({ id: company.id, practice: true })}
                  />
                ))}
              </div>
            </section>
          )}

          <History history={view.history} />

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-5 text-paper/60">
            <p>
              Your career code: <span className="font-pixel text-sm text-[#ffd319]" data-testid="career-code">{view.code}</span>
              <span className="block text-sm">Enter it on another device to carry on there.</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={onLeave} className="min-h-11 border border-line px-4 text-sm hover:border-paper/50 hover:text-paper">Enter another code</button>
              {confirmRetire ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-red">Retire and start over?</span>
                  <button onClick={() => retire.mutate()} disabled={retire.isPending} className="min-h-11 border border-red px-4 text-sm text-red hover:bg-red/10">Yes, retire</button>
                  <button onClick={() => setConfirmRetire(false)} className="min-h-11 px-3 text-sm">No</button>
                </span>
              ) : (
                <button onClick={() => setConfirmRetire(true)} className="min-h-11 border border-line px-4 text-sm hover:border-red hover:text-red">Retire</button>
              )}
            </div>
          </footer>
        </div>
      </main>
      <LampLight />

      <GreetingsModal
        open={greetingsOpen}
        greetings={contract?.greetings ?? []}
        company={contract?.company.name ?? ""}
        onClose={() => {
          setGreetingsFor(null);
          if (dayOne && contract?.senior) setNotesOpen(true); // then the senior hands over their notes
          setDayOne(false);
        }}
      />
      <NotesModal open={notesOpen} notes={contract?.senior ?? null} company={contract?.company ?? null} onClose={() => setNotesOpen(false)} />
      <AppraisalModal appraisal={appraisal} onClose={() => setAppraisal(null)} />
      <BriefingModal
        meta={briefing}
        closeLabel="BACK TO YOUR CAREER"
        onClose={() => setBriefing(null)}
        onOpenFiles={(meta) => {
          // Career cases open with a free Case Summary on file: let the case screen load the
          // full state (results included) from the server instead of just the meta.
          useCaseStore.getState().reset();
          router.push(`/case/${meta.case_id}`);
        }}
      />
      {ending && (
        <Cutscene
          scene={scene.data ?? null}
          salary={view.salary}
          title={view.title}
          onDone={() => setEnding(false)}
        />
      )}
    </div>
  );
}
