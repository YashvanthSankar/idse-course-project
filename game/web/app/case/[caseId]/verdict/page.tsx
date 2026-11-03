import { Suspense } from "react";
import { VerdictFromUrl } from "@/components/routes/FromUrl";

// The id comes from the URL in the browser (FromUrl): no server round trip before it shows.
export default function VerdictPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-ink-950">
          <p className="animate-blink font-type tracking-[0.4em] text-amber">THE JURY IS OUT…</p>
        </div>
      }
    >
      <VerdictFromUrl />
    </Suspense>
  );
}
