import { Suspense } from "react";
import { CaseFromUrl } from "@/components/routes/FromUrl";

// The id comes from the URL in the browser (FromUrl): no server round trip before it shows.
export default function CasePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-ink-950">
          <p className="animate-blink font-type tracking-[0.4em] text-amber">PULLING THE FILE…</p>
        </div>
      }
    >
      <CaseFromUrl />
    </Suspense>
  );
}
