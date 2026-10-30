"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ApiError, getCaseState } from "@/lib/api";
import { useCaseStore } from "@/lib/store";
import { CareerVerdictScreen } from "./CareerVerdictScreen";
import { VerdictScreen } from "./VerdictScreen";

/** Quick Case and Career Mode close a case differently: pick the right verdict screen. */
export function VerdictRouter({ caseId }: { caseId: string }) {
  const meta = useCaseStore((s) => s.meta);
  const inStore = meta?.case_id === caseId;
  const state = useQuery({ queryKey: ["case-state", caseId], queryFn: () => getCaseState(caseId), enabled: !inStore });
  const career = inStore ? Boolean(meta?.career) : state.data ? Boolean(state.data.meta.career) : null;
  if (!inStore && state.error instanceof ApiError && state.error.status === 404) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-950 px-6 text-center">
        <p className="font-display text-4xl italic text-paper">Case file not found.</p>
        <p className="max-w-md text-paper/70">It may have been closed a while ago, or the link is wrong.</p>
        <Link href="/" className="rounded-sm border-2 border-amber px-6 py-3 font-type tracking-[0.2em] text-amber hover:bg-amber/10">
          BACK TO THE MENU
        </Link>
      </div>
    );
  }
  if (career === null && !state.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <p className="animate-blink font-type tracking-[0.4em] text-amber">THE JURY IS OUT…</p>
      </div>
    );
  }
  return career ? <CareerVerdictScreen caseId={caseId} /> : <VerdictScreen caseId={caseId} />;
}
