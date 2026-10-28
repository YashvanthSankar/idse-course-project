/** Top-down desk clutter: coffee, pen, nameplate, ink pad, the Chief's sticky note. Decorative only. */
export function DeskProps() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
      {/* Coffee mug, seen from above, with a ring stain beside it */}
      <div className="absolute right-[4%] top-[8%] h-24 w-24 rounded-full bg-[radial-gradient(circle_at_40%_35%,#f2ece0,#c9c0ae_60%,#8d8474)] shadow-[8px_14px_24px_rgba(0,0,0,0.6)]">
        <div className="absolute inset-[11%] rounded-full bg-[radial-gradient(circle_at_45%_40%,#5a3a22,#2a160a_70%)] shadow-[inset_0_4px_10px_rgba(0,0,0,0.7)]" />
        <div className="absolute -right-5 top-8 h-9 w-7 rounded-r-full border-[6px] border-l-0 border-[#d8d0c0] shadow-[6px_6px_10px_rgba(0,0,0,0.45)]" />
      </div>
      <div className="absolute right-[13%] top-[24%] h-20 w-20 rounded-full border-[3px] border-[#5a3a1e]/35 [mask-image:conic-gradient(black_0_70%,transparent_70%_78%,black_78%)]" />

      {/* Fountain pen */}
      <div className="absolute bottom-[14%] right-[6%] h-3 w-44 -rotate-[28deg] rounded-full bg-gradient-to-b from-[#2b2b33] via-[#0c0c10] to-[#000] shadow-[6px_10px_14px_rgba(0,0,0,0.6)]">
        <div className="absolute -left-5 top-[3px] h-1.5 w-6 rounded-l-full bg-gradient-to-b from-[#f0d27a] to-[#9a7a2c]" />
        <div className="absolute right-6 top-0 h-3 w-1.5 bg-[#d8b45a]" />
      </div>

      {/* Brass nameplate */}
      <div className="absolute bottom-[5%] left-[3%] rounded-sm border border-[#6e5320] bg-gradient-to-b from-[#e2c172] via-[#b38f3c] to-[#7d6225] px-5 py-2 font-type text-sm tracking-[0.25em] text-[#2a1d08] shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
        R. DESAI · CHIEF AUDITOR
      </div>

      {/* Ink pad + rubber stamp */}
      <div className="absolute bottom-[22%] left-[2%] h-14 w-24 rounded bg-gradient-to-b from-[#3a3f4a] to-[#1d2027] p-1.5 shadow-[6px_10px_16px_rgba(0,0,0,0.6)]">
        <div className="h-full w-full rounded-sm bg-[radial-gradient(circle_at_40%_40%,#9c1f2c,#4a0c13)]" />
      </div>
      <div className="absolute bottom-[31%] left-[9%] h-12 w-12 rounded-full bg-[radial-gradient(circle_at_35%_30%,#a4683a,#5a3417)] shadow-[6px_10px_14px_rgba(0,0,0,0.6)]" />

      {/* The Chief's sticky note */}
      <div className="absolute left-[2%] top-[1%] w-40 -rotate-6 bg-[#f1dd6b] p-3 font-type text-[13px] leading-snug text-[#3b3410] shadow-[4px_10px_14px_rgba(0,0,0,0.5)]">
        Rookie —<br />start with Case No. 1. Trust the numbers, not the faces.
        <div className="mt-2 text-right">— R.D.</div>
      </div>

      {/* Paper clips */}
      <div className="absolute right-[22%] top-[6%] h-8 w-3 rotate-12 rounded-full border-2 border-[#b9bec8]" />
      <div className="absolute right-[24%] top-[9%] h-8 w-3 -rotate-[30deg] rounded-full border-2 border-[#b9bec8]" />
    </div>
  );
}
