import { Suspense } from "react";
import { PlayFromUrl } from "@/components/routes/FromUrl";

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      <PlayFromUrl />
    </Suspense>
  );
}
