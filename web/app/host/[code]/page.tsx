import { Suspense } from "react";
import { HostScreen } from "@/components/host/HostScreen";

export default function HostRoomPage({ params }: PageProps<"/host/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      {params.then(({ code }) => (
        <HostScreen code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
