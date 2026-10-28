import { Suspense } from "react";
import { VerdictScreen } from "@/components/verdict/VerdictScreen";

// Not async: params are awaited inside the Suspense boundary so the shell still prerenders.
export default function VerdictPage({ params }: PageProps<"/case/[caseId]/verdict">) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-ink-950">
          <p className="animate-blink font-type tracking-[0.4em] text-amber">THE JURY IS OUT…</p>
        </div>
      }
    >
      {params.then(({ caseId }) => (
        <VerdictScreen caseId={caseId} />
      ))}
    </Suspense>
  );
}
