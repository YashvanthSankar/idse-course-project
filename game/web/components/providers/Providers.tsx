"use client";
import { ApiError } from "@/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ShakeProvider } from "@/components/fx/Shake";
import { useSettings } from "@/lib/settings";
import { sfx } from "@/lib/sound";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // one retry for a network blip; a 404 won't change by asking again
          queries: { retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status === 404), refetchOnWindowFocus: false },
        },
      }),
  );
  const reduceEffects = useSettings((s) => s.reduceEffects);

  useEffect(() => {
    useSettings.getState().hydrate();
    // Browsers only allow audio after a user gesture: unlock on the first one.
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reduceEffects = String(reduceEffects);
  }, [reduceEffects]);

  return (
    <QueryClientProvider client={client}>
      <ShakeProvider>{children}</ShakeProvider>
    </QueryClientProvider>
  );
}
