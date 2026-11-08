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

export function ModelShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div data-site="model" className="min-h-dvh">
      <header className="model-header">
        <div className="model-header-inner">
          <Link href="/model" className="model-brand"><span>Court Case Duration Model<small>IDSE COURSE PROJECT</small></span></Link>
          <nav aria-label="Model pages" className="model-nav">
            {TABS.map((t) => {
              const active = t.href === "/model" ? path === "/model" : path?.startsWith(t.href);
              return <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}>{t.label}</Link>;
            })}
          </nav>
          <a className="model-code-link" href={REPO} target="_blank" rel="noreferrer">View project <span aria-hidden>↗</span></a>
        </div>
      </header>
      <main className="model-main mx-auto max-w-6xl px-5 sm:px-8">{children}</main>
      <footer className="model-footer mx-auto max-w-6xl px-5 sm:px-8">
        <div><strong>Court Case Duration Model</strong><p>An IDSE course project: data analysis and machine learning on real court records.</p></div>
        <p>Contains data from Development Data Lab&apos;s judicial data, ODbL v1.0.<br />A historical estimate, not legal advice. · <a href={REPO} target="_blank" rel="noreferrer">Code and method ↗</a> · <Link href="/">OUTLIER game ↗</Link></p>
      </footer>
    </div>
  );
}
