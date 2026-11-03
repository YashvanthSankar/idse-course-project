"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/model", label: "Try the model" },
  { href: "/model/analytics", label: "Analytics" },
  { href: "/model/about", label: "About the model" },
] as const;

export const REPO = "https://github.com/YashvanthSankar/idse-course-project/tree/main/pipeline";

export function ModelShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div data-site="model" className="min-h-dvh">
      <header className="border-b border-[var(--m-line)] bg-[var(--m-card)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/model" className="mr-auto">
            <span className="block text-lg font-bold tracking-tight">TAREEKH</span>
            <span className="block text-xs text-[var(--m-ink-2)]">How long does a court case take? · Tamil Nadu district courts</span>
          </Link>
          <nav aria-label="Model pages" className="flex gap-1 text-sm">
            {TABS.map((t) => {
              const active = t.href === "/model" ? path === "/model" : path?.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 ${active ? "bg-[var(--m-blue-100)] font-medium text-[var(--m-ink)]" : "text-[var(--m-ink-2)] hover:bg-[var(--m-surface)]"}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-[var(--m-ink-3)]">
        <p>
          An IDSE (CS3006) course project. Contains data from Development Data Lab&apos;s judicial data, ODbL v1.0. A historical
          estimate, not legal advice. ·{" "}
          <a className="underline" href={REPO} target="_blank" rel="noreferrer">
            Code and method
          </a>{" "}
          ·{" "}
          <Link className="underline" href="/">
            OUTLIER, the game
          </Link>
        </p>
      </footer>
    </div>
  );
}
