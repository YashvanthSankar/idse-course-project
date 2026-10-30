"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Corkboard } from "@/components/board/Corkboard";
import { LampLight } from "@/components/fx/LampLight";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { ApiError, getCareer, getCaseState, listTools, runTool } from "@/lib/api";
import { loadCaseMemory, restoreSnapshot, saveCaseMemory } from "@/lib/caseMemory";
import { cn } from "@/lib/cn";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { ToolId, ToolResult, ToolSpec } from "@/lib/types";
import { BudgetMeter } from "./BudgetMeter";
import { CodeDrawer } from "./CodeDrawer";
import { DataTable } from "./DataTable";
import { EvidenceTray } from "./EvidenceTray";
import { ResultPanel, type Running } from "./ResultPanel";
import { StepGuide } from "./StepGuide";
import { SuspectRail } from "./SuspectRail";
import { ToolKit } from "./ToolKit";
import { HackerConsole } from "@/components/hacker/HackerConsole";
import { BackButton } from "@/components/ui/BackButton";
import { NotesModal } from "@/components/career/CareerParts";

type Tab = "suspects" | "tools" | "result" | "evidence";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "suspects", label: "Suspects", icon: "☻" },
  { id: "tools", label: "Tools", icon: "⚒" },
  { id: "result", label: "Result", icon: "◧" },
  { id: "evidence", label: "Evidence", icon: "📌" },
];

function defaultParams(spec: ToolSpec): Record<string, string> {
  return Object.fromEntries(
    Object.entries(spec.params)
      .filter((e): e is [string, string[]] => Array.isArray(e[1]))
      .map(([k, v]) => [k, v[0]]),
  );
}

export function InvestigationScreen({
  caseId,
  onOpenBoard,
  redirectWhenClosed = true,
  classRoom,
  banner,
}: {
  caseId: string;
  onOpenBoard?: () => void;
  /** Solo play jumps to the verdict page when a reloaded case is already closed. */
  redirectWhenClosed?: boolean;
  /** Class Mode: the room this phone plays in, so "back" stays in the classroom */
  classRoom?: string;
  /** a strip above the header (Class Mode's round clock) */
  banner?: React.ReactNode;
}) {
  const router = useRouter();
  const store = useCaseStore();
  const storeHasCase = store.meta?.case_id === caseId;
  // Not in memory (reload, locked phone, shared link): restore everything from the server.
  const fetched = useQuery({
    queryKey: ["case-state", caseId],
    queryFn: () => getCaseState(caseId),
    enabled: !storeHasCase,
  });

  useEffect(() => {
    if (storeHasCase || !fetched.data) return;
    useCaseStore.getState().hydrate(restoreSnapshot(fetched.data, loadCaseMemory(caseId)));
    if (fetched.data.verdict && redirectWhenClosed) router.replace(`/case/${caseId}/verdict`);
  }, [storeHasCase, fetched.data, caseId, redirectWhenClosed, router]);

  // Keep pinned evidence and red strings across reloads.
  useEffect(
    () =>
      useCaseStore.subscribe((s) => {
        if (s.meta?.case_id !== caseId) return;
        const previous = loadCaseMemory(caseId);
        saveCaseMemory(caseId, { ...previous, pinned: s.pinned, links: s.links });
      }),
    [caseId],
  );

  // Restored results were already "run" before the reload: show them without the terminal replay.
  const restoredIds = useMemo(
    () => new Set((fetched.data?.results ?? []).map((r) => r.result_id)),
    [fetched.data],
  );

  const meta = storeHasCase ? store.meta : null;
  const career = meta?.career ?? null;
  const home = classRoom ? `/play/${classRoom}` : career ? "/career" : "/office";
  const homeLabel = classRoom ? "Class" : career ? "Career" : "Case desk";
  const lockedText = career ? "isn't available at this tier yet — bigger companies unlock it." : null;
  // Career Mode: the senior's notes on this company stay one tap away
  const contract = useQuery({
    queryKey: ["career", career?.code ?? ""],
    queryFn: () => getCareer(career!.code),
    enabled: career !== null,
  }).data?.contract ?? null;
  const [notesOpen, setNotesOpen] = useState(false);
  const tools = useQuery({
    queryKey: ["tools", meta?.level],
    queryFn: () => listTools(meta!.level),
    enabled: meta !== null,
  });

  const [params, setParams] = useState<Record<string, Record<string, string>>>({});
  const [running, setRunning] = useState<Running>(null);
  const [revealedRuns, setRevealed] = useState<Set<string>>(() => new Set());
  const revealed = useMemo(() => new Set([...restoredIds, ...revealedRuns]), [restoredIds, revealedRuns]);
  const [errorTick, setErrorTick] = useState(0);
  const [cachedId, setCachedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"code" | "data" | null>(null);
  const [tab, setTab] = useState<Tab>("tools");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [hackerOpen, setHackerOpen] = useState(false);
  const openBoard = useCallback(() => {
    if (onOpenBoard) return onOpenBoard();
    sfx.play("whoosh");
    setBoardOpen(true);
  }, [onOpenBoard]);
  const closeBoard = useCallback(() => setBoardOpen(false), []);
  const desktop = useMediaQuery("(min-width: 768px)");
  const wide = useMediaQuery("(min-width: 1024px)");
  const muted = useSettings((s) => s.muted);
  const updateSettings = useSettings((s) => s.update);

  useEffect(() => {
    sfx.loop("rain");
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

  const run = useMutation({
    mutationFn: ({ spec, p }: { spec: ToolSpec; p: Record<string, string> }) =>
      runTool(caseId, spec.id as ToolId, p),
    onMutate: ({ spec, p }) => {
      setRunning({ toolId: spec.id, params: p });
      setTab("result");
      sfx.play("whoosh");
    },
    onSuccess: (result: ToolResult) => {
      const st = useCaseStore.getState();
      st.addResult(result);
      st.setBudgetLeft(result.budget_left);
      if (result.cost_charged > 0) {
        sfx.play("coin");
        setCachedId(null);
      } else {
        sfx.play("tick");
        setCachedId(result.result_id);
        setRevealed((r) => new Set(r).add(result.result_id));
      }
    },
    onError: (err) => {
      setErrorTick((n) => n + 1);
      if (err instanceof ApiError && err.status === 409) {
        sfx.play("wrong");
        showToast("Out of budget — re-run an earlier tool for free, or make your accusation.");
      } else if (err instanceof ApiError && err.status === 403) {
        sfx.play("buzz");
        showToast("That tool is locked for this case.");
      } else {
        sfx.play("buzz");
        showToast(`The lab is not answering (${err.message}).`);
      }
    },
    onSettled: () => setRunning(null),
  });

  const specs = useMemo(() => tools.data ?? [], [tools.data]);
  const paramsFor = useCallback(
    (spec: ToolSpec) => ({ ...defaultParams(spec), ...params[spec.id] }),
    [params],
  );
  const trigger = useCallback(
    (spec: ToolSpec) => {
      if (!spec.unlocked) {
        sfx.play("buzz");
        showToast(lockedText ? `${spec.name} ${lockedText}` : `${spec.name} unlocks at Case ${spec.unlock_level}.`);
        return;
      }
      setSelectedTool(spec.id);
      const p = paramsFor(spec);
      // Re-running a result you already have is free; anything new needs the coins for it.
      const same = (r: ToolResult) =>
        r.tool_id === spec.id && Object.entries(p).every(([k, v]) => String((r.params as Record<string, unknown>)[k] ?? v) === v);
      const st = useCaseStore.getState();
      if (spec.cost > (st.meta?.budget_left ?? 0) && !st.results.some(same)) {
        setErrorTick((n) => n + 1);
        sfx.play("wrong");
        showToast("Out of budget — re-run an earlier tool for free, or make your accusation.");
        return;
      }
      if (!run.isPending) run.mutate({ spec, p });
    },
    [run, paramsFor, showToast, lockedText],
  );
  const select = useCallback(
    (spec: ToolSpec) => {
      if (!spec.unlocked) {
        sfx.play("buzz");
        showToast(lockedText ? `${spec.name} ${lockedText}` : `${spec.name} unlocks at Case ${spec.unlock_level}.`);
        return;
      }
      setSelectedTool((cur) => (cur === spec.id ? null : spec.id));
    },
    [showToast, lockedText],
  );

  // Number keys 1–9 run the tools in kit order.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (drawer || settings || boardOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && specs[n - 1]) trigger(specs[n - 1]);
      if (e.key === "b" || e.key === "B") openBoard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [specs, trigger, drawer, settings, boardOpen, openBoard]);

  const active = store.results.find((r) => r.result_id === store.activeResultId) ?? null;
  const flagged = active && revealed.has(active.result_id) ? active.implicates : [];
  const pinnedResults = store.pinned
    .map((id) => store.results.find((r) => r.result_id === id))
    .filter((r): r is ToolResult => Boolean(r));
  const flaggedTxns = useMemo(
    () => new Set<string>((active?.table ?? []).map((row) => String((row as Record<string, unknown>).txn_id ?? "")).filter(Boolean)),
    [active],
  );
  const closeDrawer = useCallback(() => setDrawer(null), []);

  if (!meta || desktop === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950 p-6 text-center">
        {fetched.isError ? (
          <div className="tex-paper max-w-md -rotate-1 rounded-[2px] p-8 shadow-2xl">
            <h1 className="font-display text-3xl italic">Case file not found</h1>
            <p className="mt-2 font-type text-sm opacity-80">
              This folder isn&apos;t in the records room. It may have expired — open a fresh one.
            </p>
            <Link href="/office" className="mt-6 inline-block font-type tracking-[0.3em] text-[#8f1d27] underline">
              BACK TO THE DESK
            </Link>
          </div>
        ) : (
          <p className="animate-blink font-type tracking-[0.4em] text-amber">PULLING THE FILE…</p>
        )}
      </div>
    );
  }

  const panels = {
    suspects: (
      <SuspectRail
        caseId={caseId}
        suspects={meta.suspects}
        flagged={flagged}
        flaggedBy={active ? active.title.split(" · ")[0] : undefined}
      />
    ),
    result: (
      <ResultPanel
        results={store.results}
        active={active}
        running={running}
        revealed={revealed}
        cached={active !== null && active.result_id === cachedId}
        onRevealed={(id) => setRevealed((r) => new Set(r).add(id))}
        onSelect={(id) => store.setActive(id)}
        pinned={active ? store.pinned.includes(active.result_id) : false}
        onPin={() => {
          if (!active) return;
          sfx.play("pin");
          store.pin(active.result_id);
        }}
        onCode={() => {
          sfx.play("whoosh");
          setDrawer("code");
        }}
        onData={() => {
          sfx.play("rustle");
          setDrawer("data");
        }}
        suspects={meta.suspects}
        phone={!desktop}
      />
    ),
    evidence: (
      <EvidenceTray
        pinned={pinnedResults}
        files={career ? career.culprits : 2}
        career={career !== null}
        suspects={meta.suspects}
        onUnpin={(id) => store.unpin(id)}
        onSelect={(id) => {
          store.setActive(id);
          setTab("result");
        }}
        onOpenBoard={openBoard}
      />
    ),
    tools: (
      <>
        <ToolKit
          specs={specs}
          params={Object.fromEntries(specs.map((s) => [s.id, paramsFor(s)]))}
          selected={selectedTool}
          onSelect={select}
          onParam={(tool, name, value) => setParams((p) => ({ ...p, [tool]: { ...p[tool], [name]: value } }))}
          onRun={trigger}
          busy={run.isPending}
          budgetLeft={meta.budget_left}
          lockedLabel={career ? "bigger firms" : undefined}
          roles={career !== null}
        />
        <button
          onClick={() => setHackerOpen(true)}
          className="mt-6 flex w-full items-center gap-3 rounded-lg border border-green/30 px-3 py-2.5 text-left text-sm text-green/90 transition-colors hover:border-green/60 hover:bg-green/5"
        >
          <span className="font-mono">&gt;_</span>
          <span>
            Hacker Mode
            <span className="block text-xs text-paper/50">Write your own pandas · 1 coin a run</span>
          </span>
        </button>
      </>
    ),
  } satisfies Record<Tab, React.ReactNode>;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[radial-gradient(ellipse_at_50%_0%,#151b28_0%,#0a0d13_55%,#07080b_100%)] md:h-dvh md:overflow-clip">
      {banner}
      <header className="relative z-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/5 bg-[#0b0d12]/90 px-4 py-3 backdrop-blur sm:px-6">
        <BackButton href={home} label={homeLabel} short={homeLabel === "Case desk" ? "Desk" : homeLabel} />
        <Link href={home} onClick={() => sfx.play("tick")} className="hidden arcade-logo font-pixel text-xs sm:inline" title={`Back to the ${homeLabel.toLowerCase()}`}>
          OUTLIER
        </Link>
        <div className="min-w-0 flex-1 lg:max-w-[36ch] lg:flex-none">
          <p className="whitespace-nowrap text-xs text-amber/80">
            {career ? `Case ${career.index} of ${career.total}${career.culprits > 1 ? " · two fraudsters" : ""}` : `Case ${meta.level}`}
          </p>
          <h1 data-testid="case-title" title={meta.title} className="line-clamp-2 font-display text-lg italic leading-tight text-paper sm:truncate sm:text-xl">
            {meta.title}
          </h1>
        </div>
        {contract?.senior && (
          <button
            onClick={() => {
              sfx.play("rustle");
              setNotesOpen(true);
            }}
            data-testid="case-notes"
            aria-label={`Notes from ${contract.senior.name.split(" ")[0]}`}
            title={`Notes from ${contract.senior.name.split(" ")[0]}`}
            className="min-h-11 min-w-11 rounded-sm border border-amber/50 px-3 text-xs text-amber hover:bg-amber/10"
          >
            📒<span className="hidden 2xl:inline"> Notes from {contract.senior.name.split(" ")[0]}</span>
          </button>
        )}
        <NotesModal open={notesOpen} notes={contract?.senior ?? null} company={contract?.company ?? null} onClose={() => setNotesOpen(false)} />
        {/* tablets: the guide gets its own row under the header; wider screens: in the middle */}
        <div className="order-last hidden basis-full justify-center md:flex lg:order-none lg:basis-auto lg:flex-1">
          <StepGuide results={store.results.length} pinned={store.pinned.length} clues={career ? career.culprits : 2} />
        </div>
        <div className="flex items-center gap-5">
          <BudgetMeter budget={meta.budget} left={meta.budget_left} errorTick={errorTick} />
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateSettings({ muted: !muted })}
              aria-label={muted ? "Unmute sound" : "Mute sound"}
              className="flex h-8 w-8 items-center justify-center rounded-md text-paper/60 hover:bg-white/5 hover:text-amber"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => setSettings(true)} aria-label="Settings" className="flex h-8 w-8 items-center justify-center rounded-md text-paper/60 hover:bg-white/5 hover:text-amber">
              ⚙
            </button>
          </div>
        </div>
      </header>

      {desktop ? (
        /* Desktop: tool kit | result | suspects + evidence. Tablet: tool kit | result with the rest below. */
        <div className="grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)] lg:grid-cols-[288px_minmax(0,1fr)_280px]">
          <aside className="min-h-0 overflow-y-auto border-r border-white/5 bg-black/20 px-3 py-5">{panels.tools}</aside>
          <main className="min-h-0 overflow-y-auto px-5 py-5 xl:px-8">
            {panels.result}
            {!wide && (
              <div className="mt-6 grid grid-cols-2 gap-6">
                {panels.suspects}
                {panels.evidence}
              </div>
            )}
          </main>
          {wide && (
            <aside className="flex min-h-0 flex-col gap-8 overflow-y-auto border-l border-white/5 bg-black/20 px-4 py-5">
              {panels.suspects}
              {panels.evidence}
            </aside>
          )}
        </div>
      ) : (
        /* Phone: one panel at a time with a bottom tab bar */
        <>
          <div className="border-b border-white/5 px-4 py-2.5">
            <StepGuide results={store.results.length} pinned={store.pinned.length} clues={career ? career.culprits : 2} />
          </div>
          <div className="flex-1 px-4 pb-24 pt-4">{panels[tab]}</div>
          <nav aria-label="Investigation sections" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-[#0b0d12]/95 backdrop-blur">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  sfx.play("tick");
                  setTab(t.id);
                }}
                aria-current={tab === t.id}
                className={cn("relative flex flex-col items-center gap-0.5 py-2 text-xs", tab === t.id ? "text-amber" : "text-paper/55")}
              >
                <span aria-hidden className="text-base leading-none">{t.icon}</span>
                {t.label}
                {t.id === "evidence" && store.pinned.length > 0 && (
                  <span className="absolute right-[22%] top-1 rounded-full bg-red px-1.5 text-[10px] text-paper">{store.pinned.length}</span>
                )}
              </button>
            ))}
          </nav>
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            role="alert"
            data-testid="toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed left-1/2 top-20 z-[110] w-[min(92vw,460px)] -translate-x-1/2 rounded-lg border border-red/60 bg-ink-900/95 px-4 py-3 text-center text-[15px] text-[#ffd9da] shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <CodeDrawer result={drawer === "code" ? active : null} onClose={closeDrawer} suspects={meta.suspects} />
      <DataTable
        caseId={caseId}
        open={drawer === "data"}
        onClose={closeDrawer}
        suspects={meta.suspects}
        implicated={active?.implicates ?? []}
        flaggedTxns={flaggedTxns}
      />
      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
      <Corkboard open={boardOpen} onClose={closeBoard} caseId={caseId} suspects={meta.suspects} results={pinnedResults} />
      <LampLight size={800} />
      <HackerConsole
        caseId={caseId}
        open={hackerOpen}
        onClose={() => setHackerOpen(false)}
        onBudget={(left) => useCaseStore.getState().setBudgetLeft(left)}
      />
    </div>
  );
}
