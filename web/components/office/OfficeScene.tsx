"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefingModal } from "@/components/case/BriefingModal";
import { LampLight } from "@/components/fx/LampLight";
import { createCase, listLevels } from "@/lib/api";
import { isUnlocked } from "@/lib/progress";
import { useProgress } from "@/lib/useProgress";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";
import { useCaseStore } from "@/lib/store";
import type { CaseMeta } from "@/lib/types";
import { CaseFolder, FolderSkeleton } from "./CaseFolder";
import { DeskProps } from "./DeskProps";
import { OfficeWindow } from "./OfficeWindow";
import { TopBar } from "./TopBar";

export function OfficeScene() {
  const unlockAll = useSettings((s) => s.unlockAll);
  const router = useRouter();
  const progress = useProgress();
  const levels = useQuery({ queryKey: ["levels"], queryFn: listLevels, retry: 1 });
  const [briefing, setBriefing] = useState<CaseMeta | null>(null);
  const open = useMutation({
    mutationFn: (level: number) => createCase(level),
    onSuccess: (meta) => {
      sfx.play("whoosh");
      setBriefing(meta);
    },
  });

  useEffect(() => {
    sfx.loop("rain");
    sfx.loop("jazz");
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-ink-950">
      <TopBar />
      <OfficeWindow />
      <main className="tex-desk relative flex-1 px-4 pb-16 pt-8 sm:px-8">
        {/* A warm pool from the desk lamp, fixed in the top-left corner */}
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(245,165,36,0.16),transparent_65%)]" />
        <DeskProps />

        <div className="relative mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <p className="font-type text-xs tracking-[0.45em] text-amber/80">OPEN INVESTIGATIONS</p>
            <h1 className="mt-1 font-display text-4xl italic text-paper sm:text-5xl">The Case Desk</h1>
          </div>

          {levels.isError ? (
            <div className="tex-paper mx-auto max-w-md -rotate-1 rounded-[2px] p-8 text-center shadow-2xl">
              <p className="font-type text-xs tracking-[0.35em] opacity-60">NOTICE</p>
              <h2 className="mt-2 font-display text-3xl italic">The office is closed</h2>
              <p className="mt-2 font-type text-sm opacity-80">
                The records room isn&apos;t answering — backend offline. Start the Python brain and knock again.
              </p>
              <button
                onClick={() => levels.refetch()}
                className="mt-6 rounded-sm border-2 border-[#8f1d27] px-6 py-2 font-type tracking-[0.3em] text-[#8f1d27] hover:bg-[#8f1d27] hover:text-paper"
              >
                RETRY
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-10 [&>*]:basis-full min-[420px]:[&>*]:basis-[calc(50%-12px)] md:[&>*]:basis-[calc(33.333%-16px)] lg:[&>*]:basis-[calc(25%-18px)]">
              {levels.data
                ? levels.data.map((info) => (
                    <CaseFolder
                      key={info.level}
                      info={info}
                      locked={!unlockAll && !isUnlocked(progress, info.level)}
                      best={progress.best[info.level]}
                      opening={open.isPending && open.variables === info.level}
                      onOpen={() => open.mutate(info.level)}
                    />
                  ))
                : Array.from({ length: 7 }, (_, i) => <FolderSkeleton key={i} index={i} />)}
            </div>
          )}

          {open.isError && (
            <p role="alert" className="mt-8 text-center font-type text-sm text-red">
              The file room jammed: {open.error.message}. Try again.
            </p>
          )}
        </div>
      </main>
      <LampLight />
      <BriefingModal
        meta={briefing}
        onClose={() => setBriefing(null)}
        onOpenFiles={(meta) => {
          useCaseStore.getState().setMeta(meta);
          router.push(`/case/${meta.case_id}`);
        }}
      />
    </div>
  );
}
