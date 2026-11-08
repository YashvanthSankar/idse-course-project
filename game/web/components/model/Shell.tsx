"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/model", label: "Home" },
  { href: "/model/explore", label: "Test the model" },
  { href: "/model/pipeline", label: "Pipeline" },
  { href: "/model/analytics", label: "Data analysis" },
] as const;
export const REPO = "https://github.com/YashvanthSankar/idse-course-project/tree/main/pipeline";

/** A buff case file tied with red tape. */
function FileMark() {
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden>
      <rect width="24" height="20" rx="2" fill="#e0c894" />
      <rect x="15" width="3" height="20" fill="#a8322a" />
      <rect y="8.5" width="24" height="3" fill="#a8322a" />
    </svg>
  );
}

export function ModelShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div data-site="model">
      <header className="m-top">
        <div className="m-wrap m-top-inner">
          <Link href="/model" className="m-brand">
            <FileMark />
            Court Case Duration Model
          </Link>
          <nav aria-label="Model pages" className="m-nav">
            {TABS.map((t) => {
              const active = t.href === "/model" ? path === "/model" : path?.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <a className="m-code" href={REPO} target="_blank" rel="noreferrer">
            Code on GitHub
          </a>
        </div>
      </header>
      <main>{children}</main>
      <footer className="m-foot">
        <div className="m-wrap">
          <p>
            IDSE course project (CS3006, IIITDM). Contains data from Development Data Lab&apos;s judicial data, ODbL v1.0. A historical estimate, not legal advice. Photograph: Madras High Court by Yercaud-elango, CC BY 4.0, via Wikimedia Commons.{" "}
            <Link href="/">OUTLIER game</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
