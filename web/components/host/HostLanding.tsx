"use client";
import { BackButton } from "@/components/ui/BackButton";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Rain } from "@/components/fx/Rain";
import { createRoom } from "@/lib/api";
import { saveHostToken } from "@/lib/hostToken";
import { sfx } from "@/lib/sound";

export function HostLanding() {
  const router = useRouter();
  const start = useMutation({
    mutationFn: createRoom,
    onSuccess: ({ code, host_token }) => {
      if (host_token) saveHostToken(code, host_token);
      sfx.play("stamp");
      router.push(`/host/${code}`);
    },
  });

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,#1b2540_0%,#07080b_70%)] px-6">
      <BackButton href="/" label="Menu" className="absolute left-4 top-4 z-20" />
      <Rain density={200} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-2xl text-center"
      >
        <p className="font-type text-sm tracking-[0.35em] text-cyan">CLASS MODE</p>
        <h1 className="mt-4 font-display text-6xl font-black italic text-paper sm:text-7xl">
          The whole class, one case.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-paper/75">
          Put this screen on the projector. Students scan a QR code, race the same fraud case on their
          phones, and then the class becomes the dataset.
        </p>
        <button
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="mt-10 rounded border-2 border-amber bg-amber/10 px-10 py-4 font-type text-xl tracking-[0.25em] text-amber transition hover:bg-amber/20 disabled:opacity-50"
        >
          {start.isPending ? "OPENING THE ROOM…" : "START A CLASS SESSION"}
        </button>
        {start.isError && (
          <p className="mt-4 text-red">The Python brain isn&apos;t answering. Is the backend running?</p>
        )}
      </motion.div>
    </main>
  );
}
