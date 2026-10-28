"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Corkboard } from "@/components/board/Corkboard";
import { LampLight } from "@/components/fx/LampLight";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { ApiError, getCase, listTools, runTool } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { ToolId, ToolResult, ToolSpec } from "@/lib/types";
import { BudgetMeter } from "./BudgetMeter";
import { CaseTimer } from "./CaseTimer";
import { CodeDrawer } from "./CodeDrawer";
import { DataTable } from "./DataTable";
import { EvidenceTray } from "./EvidenceTray";
import { ResultPanel, type Running } from "./ResultPanel";
import { SuspectRail } from "./SuspectRail";
import { ToolKit } from "./ToolKit";

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

export function InvestigationScreen({ caseId, onOpenBoard }: { caseId: string; onOpenBoard?: () => void }) {
  const store = useCaseStore();
  const storeHasCase = store.meta?.case_id === caseId;
  const fetched = useQuery({ queryKey: ["case", caseId], queryFn: () => getCase(caseId), enabled: !storeHasCase });

  useEffect(() => {
    if (!storeHasCase && fetched.data) useCaseStore.getState().setMeta(fetched.data);
  }, [storeHasCase, fetched.data]);

  const meta = storeHasCase ? store.meta : null;
  const tools = useQuery({
    queryKey: ["tools", meta?.level],
    queryFn: () => listTools(meta!.level),
    enabled: meta !== null,
  });

  const [params, setParams] = useState<Record<string, Record<string, string>>>({});
  const [running, setRunning] = useState<Running>(null);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [errorTick, setErrorTick] = useState(0);
  const [cachedId, setCachedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"code" | "data" | null>(null);
  const [tab, setTab] = useState<Tab>("tools");
  const [settings, setSettings] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
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
        showToast(`${spec.name} unlocks at Case ${spec.unlock_level}.`);
        return;
      }
      if (!run.isPending) run.mutate({ spec, p: paramsFor(spec) });
    },
    [run, paramsFor, showToast],
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
    suspects: <SuspectRail suspects={meta.suspects} flagged={flagged} />,
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
      />
    ),
    evidence: (
      <EvidenceTray
        pinned={pinnedResults}
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
      <ToolKit
        specs={specs}
        params={Object.fromEntries(specs.map((s) => [s.id, paramsFor(s)]))}
        onParam={(tool, name, value) => setParams((p) => ({ ...p, [tool]: { ...p[tool], [name]: value } }))}
        onRun={trigger}
        busy={run.isPending}
        budgetLeft={meta.budget_left}
      />
    ),
  } satisfies Record<Tab, React.ReactNode>;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[radial-gradient(ellipse_at_50%_0%,#151b28_0%,#0a0d13_55%,#07080b_100%)] md:h-dvh md:overflow-hidden">
      <header className="relative z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/60 bg-[#0b0d12]/90 px-3 py-2 backdrop-blur sm:px-5">
        <Link href="/office" onClick={() => sfx.play("tick")} className="font-display text-lg font-black italic text-[#ffd9da] [text-shadow:0_0_10px_rgba(229,72,77,0.8)]" title="Back to the case desk">
          The Auditor
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-type text-[10px] tracking-[0.35em] text-amber/80">CASE No. {String(meta.level).padStart(2, "0")}</p>
          <h1 data-testid="case-title" className="truncate font-display text-lg italic leading-tight text-paper sm:text-xl">
            {meta.title}
          </h1>
        </div>
        <CaseTimer caseId={caseId} />
        <BudgetMeter budget={meta.budget} left={meta.budget_left} errorTick={errorTick} />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => updateSettings({ muted: !muted })}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="rounded border border-line px-2 py-1 font-mono text-xs text-muted hover:border-amber hover:text-amber"
          >
            {muted ? "♪ OFF" : "♪ ON"}
          </button>
          <button onClick={() => setSettings(true)} aria-label="Settings" className="rounded border border-line px-2 py-1 font-mono text-xs text-muted hover:border-amber hover:text-amber">
            ⚙
          </button>
        </div>
      </header>

      {desktop ? (
        /* Desktop / tablet: suspects | workspace | evidence, over a docked tool kit */
        <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[230px_minmax(0,1fr)_250px]">
          <aside className="min-h-0 overflow-y-auto border-r border-line/60 p-3">{panels.suspects}</aside>
          <main className="min-h-0 overflow-y-auto p-4">
            {panels.result}
            {!wide && <div className="mt-4">{panels.evidence}</div>}
          </main>
          {wide && <aside className="min-h-0 overflow-y-auto border-l border-line/60 p-3">{panels.evidence}</aside>}
          <footer className="col-span-full border-t border-line/70 bg-[#0b0d12]/95 p-3">{panels.tools}</footer>
        </div>
      ) : (
        /* Phone: one panel at a time with a bottom tab bar */
        <>
          <div className="flex-1 p-3 pb-24">{panels[tab]}</div>
          <nav aria-label="Investigation sections" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-[#0b0d12]/95 backdrop-blur">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  sfx.play("tick");
                  setTab(t.id);
                }}
                aria-current={tab === t.id}
                className={cn("relative flex flex-col items-center gap-0.5 py-2 font-type text-[11px] tracking-widest", tab === t.id ? "text-amber" : "text-muted")}
              >
                <span aria-hidden className="text-base leading-none">{t.icon}</span>
                {t.label}
                {t.id === "evidence" && store.pinned.length > 0 && (
                  <span className="absolute right-[22%] top-1 rounded-full bg-red px-1.5 font-mono text-[9px] text-paper">{store.pinned.length}</span>
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
            className="fixed left-1/2 top-16 z-[110] w-[min(92vw,460px)] -translate-x-1/2 rounded-md border border-red/60 bg-ink-900/95 px-4 py-3 text-center font-type text-sm text-[#ffd9da] shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <CodeDrawer result={drawer === "code" ? active : null} onClose={closeDrawer} />
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
    </div>
  );
}
