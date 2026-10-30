import { Suspense } from "react";
import { AutopsyFromUrl } from "@/components/routes/FromUrl";

export default function AutopsyPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      <AutopsyFromUrl />
    </Suspense>
  );
}
