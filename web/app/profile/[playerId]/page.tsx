import { Suspense } from "react";
import { DetectiveCardPage } from "@/components/profile/DetectiveCard";

export default function ProfilePage({ params }: PageProps<"/profile/[playerId]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      {params.then(({ playerId }) => (
        <DetectiveCardPage playerId={playerId} />
      ))}
    </Suspense>
  );
}
