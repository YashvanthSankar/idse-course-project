import Link from "next/link";

export default function NotFound() {
  return (
    <main className="tex-desk flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="tex-paper relative w-full max-w-md -rotate-1 rounded-[2px] px-8 py-10 text-center shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
        <p className="pr-20 font-type text-xs tracking-[0.3em] opacity-60 sm:pr-0">RECORDS ROOM · FILE 404</p>
        <h1 className="mt-3 font-display text-5xl font-black italic">Case not found</h1>
        <p className="mt-4 text-base leading-relaxed opacity-80">
          Somebody shredded this page — or it never existed. Either way, there&apos;s nothing to audit here.
        </p>
        <span
          aria-hidden
          className="absolute -right-3 -top-4 rotate-12 bg-[#efe6d2] rounded border-[3px] border-double border-[#b3262e] px-2 py-0.5 font-type text-sm tracking-[0.2em] text-[#b3262e] opacity-80"
        >
          MISSING
        </span>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/office"
            className="rounded-sm bg-[#2a2418] px-5 py-3 font-type tracking-[0.2em] text-paper hover:bg-black"
          >
            TO THE CASE DESK
          </Link>
          <Link
            href="/"
            className="rounded-sm border border-[#2a2418]/40 px-5 py-3 font-type tracking-[0.2em] hover:border-[#2a2418]"
          >
            TITLE SCREEN
          </Link>
        </div>
      </div>
    </main>
  );
}
