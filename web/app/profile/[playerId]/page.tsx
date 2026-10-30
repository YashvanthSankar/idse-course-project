import { Suspense } from "react";
import { ProfileFromUrl } from "@/components/routes/FromUrl";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" />}>
      <ProfileFromUrl />
    </Suspense>
  );
}
