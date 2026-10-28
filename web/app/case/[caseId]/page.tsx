import { Suspense } from "react";
import { InvestigationScreen } from "@/components/case/InvestigationScreen";

// Not async: params are awaited inside the Suspense boundary so the shell still prerenders.
export default function CasePage({ params }: PageProps<"/case/[caseId]">) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-ink-950">
          <p className="animate-blink font-type tracking-[0.4em] text-amber">PULLING THE FILE…</p>
        </div>
      }
    >
      {params.then(({ caseId }) => (
        <InvestigationScreen caseId={caseId} />
      ))}
    </Suspense>
  );
}
