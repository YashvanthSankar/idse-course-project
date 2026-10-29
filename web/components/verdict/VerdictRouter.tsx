"use client";
import { useQuery } from "@tanstack/react-query";
import { getCaseState } from "@/lib/api";
import { useCaseStore } from "@/lib/store";
import { CareerVerdictScreen } from "./CareerVerdictScreen";
import { VerdictScreen } from "./VerdictScreen";

/** Quick Case and Career Mode close a case differently: pick the right verdict screen. */
export function VerdictRouter({ caseId }: { caseId: string }) {
  const meta = useCaseStore((s) => s.meta);
  const inStore = meta?.case_id === caseId;
  const state = useQuery({ queryKey: ["case-state", caseId], queryFn: () => getCaseState(caseId), enabled: !inStore });
  const career = inStore ? Boolean(meta?.career) : state.data ? Boolean(state.data.meta.career) : null;
  if (career === null && !state.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <p className="animate-blink font-type tracking-[0.4em] text-amber">THE JURY IS OUT…</p>
      </div>
    );
  }
  return career ? <CareerVerdictScreen caseId={caseId} /> : <VerdictScreen caseId={caseId} />;
}
