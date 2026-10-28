import { Suspense } from "react";
import { PlayScreen } from "@/components/play/PlayScreen";

export default function PlayPage({ params }: PageProps<"/play/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      {params.then(({ code }) => (
        <PlayScreen code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
