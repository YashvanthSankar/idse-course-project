import { Suspense } from "react";
import { AutopsyDeck } from "@/components/autopsy/AutopsyDeck";

export default function AutopsyPage({ params }: PageProps<"/host/[code]/autopsy">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      {params.then(({ code }) => (
        <AutopsyDeck code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
