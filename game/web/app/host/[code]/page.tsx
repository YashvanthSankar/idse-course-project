import { Suspense } from "react";
import { HostFromUrl } from "@/components/routes/FromUrl";

export default function HostRoomPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      <HostFromUrl />
    </Suspense>
  );
}
