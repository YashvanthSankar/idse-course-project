"use client";
import { usePathname } from "next/navigation";
import { FilmGrain } from "@/components/fx/FilmGrain";
import { Vignette } from "@/components/fx/Vignette";

/** The game's mood effects. The /model pages are a separate, plain site: no grain, no vignette. */
export function GameFx() {
  const path = usePathname();
  if (path?.startsWith("/model")) return null;
  return (
    <>
      <Vignette />
      <FilmGrain />
    </>
  );
}
