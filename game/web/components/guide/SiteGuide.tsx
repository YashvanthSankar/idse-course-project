"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

const GITHUB = "https://github.com/YashvanthSankar/idse-course-project";
const RAW = `${GITHUB}/raw/main`;

const DOWNLOADS = [
  { label: "Report (PDF)", href: `${RAW}/submission/pipeline-report/Court-Case-Duration-Report.pdf` },
  { label: "Slides (PPTX)", href: `${RAW}/submission/Court-Case-Duration-Presentation.pptx` },
  { label: "Notebooks", href: `${GITHUB}/tree/main/pipeline/notebooks` },
  { label: "Trained model (6 kB)", href: `${RAW}/pipeline/artifacts/within_1y/model.joblib` },
  { label: "All code", href: GITHUB },
] as const;

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a2b22]">{children}</h3>;
}

function PageLink({ href, title, onGo, children }: { href: string; title: string; onGo: () => void; children: ReactNode }) {
  return (
    <li>
      <Link href={href} onClick={onGo} className="font-semibold text-[#1d1a16] underline decoration-[#8a2b22]/40 underline-offset-4 hover:decoration-[#8a2b22]">
        {title}
      </Link>
      <span className="text-[#4a443c]">: {children}</span>
    </li>
  );
}

/** "What's on this site": a short, closable guide to both projects, shown once on a first visit. */
export function SiteGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="What's on this site" className="max-w-2xl">
      <div className="rounded-lg bg-[#f7f3ea] p-5 font-sans text-[15px] leading-relaxed text-[#1d1a16] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">What&apos;s on this site</h2>
            <p className="mt-1 text-[#4a443c]">
              Two projects for the IDSE course (CS3006, IIITDM Kancheepuram) by Yashvanth S, Jeevanandham T and
              Nithillakrishi PY.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-[#4a443c] hover:bg-black/5 hover:text-[#1d1a16]"
          >
            ×
          </button>
        </div>

        <section className="mt-5 border-t border-black/10 pt-4">
          <Heading>1 · Court case duration model</Heading>
          <p className="mt-1">
            Will a Tamil Nadu court case finish within a year? Built from 81 million real court records.
          </p>
          <ul className="mt-2 space-y-1">
            <PageLink href="/model/explore" title="Test the model" onGo={onClose}>choose a case, press Analyze, see the chance and why</PageLink>
            <PageLink href="/model/pipeline" title="Pipeline" onGo={onClose}>every step from raw data to model, with its code</PageLink>
            <PageLink href="/model/analytics" title="Data analysis" onGo={onClose}>what the court data shows</PageLink>
          </ul>
          <p className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
            <span className="mr-1 font-semibold">Download:</span>
            {DOWNLOADS.map((d) => (
              <a
                key={d.label}
                href={d.href}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-black/15 bg-white px-2 py-0.5 text-sm hover:border-[#8a2b22] hover:text-[#8a2b22]"
              >
                {d.label}
              </a>
            ))}
          </p>
        </section>

        <section className="mt-5 border-t border-black/10 pt-4">
          <Heading>2 · OUTLIER, the detective game</Heading>
          <p className="mt-1">Find the employee cooking a company&apos;s books, using real data analysis.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>On the title screen choose <b>Quick Case</b> and open case 1.</li>
            <li>Run tools on the ledger. Each costs coins, so pick carefully.</li>
            <li>Pin two clues, press <b>B</b> for the board and tie them to a suspect.</li>
            <li>Hold <b>Make the accusation</b>. The reveal shows how the fraud was hidden.</li>
          </ol>
          <p className="mt-2 text-[#4a443c]">
            Also: <b>Career</b> (climb from small firms to the Final) and <b>Class Mode</b> (a whole class plays on
            their phones).
          </p>
        </section>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link
            href="/"
            onClick={onClose}
            className="rounded bg-[#1d1a16] px-4 py-2 font-semibold text-[#f7f3ea] hover:bg-[#8a2b22]"
          >
            Play the game
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#1d1a16]/30 px-4 py-2 font-semibold hover:border-[#1d1a16]"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
