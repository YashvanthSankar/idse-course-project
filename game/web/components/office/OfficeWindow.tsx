import { Rain } from "@/components/fx/Rain";
import { mulberry32 } from "@/lib/random";

const rnd = mulberry32(1987);
const BOKEH = Array.from({ length: 46 }, () => ({
  x: rnd() * 100,
  y: 35 + rnd() * 60,
  r: 6 + rnd() * 26,
  c: rnd() < 0.62 ? "245,165,36" : rnd() < 0.6 ? "76,201,240" : "229,72,77",
  a: 0.18 + rnd() * 0.4,
}));
const BEADS = Array.from({ length: 70 }, () => ({ x: rnd() * 100, y: rnd() * 100, r: 1 + rnd() * 2.6 }));

/** The rain-streaked office window behind the desk: an out-of-focus city at night. */
export function OfficeWindow() {
  return (
    <div aria-hidden className="relative h-[20vh] min-h-32 overflow-hidden border-b-[10px] border-[#2a1b10] shadow-[inset_0_-20px_40px_rgba(0,0,0,0.6)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0b1222_0%,#131c33_55%,#1f1a26_100%)]" />
      <div className="absolute inset-0">
        {BOKEH.map((b, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.r,
              height: b.r,
              background: `radial-gradient(circle, rgba(${b.c},${b.a}) 0%, rgba(${b.c},${b.a * 0.4}) 55%, transparent 72%)`,
              filter: "blur(1.5px)",
            }}
          />
        ))}
      </div>
      <Rain density={160} lightning />
      {/* Beads of water stuck to the glass */}
      <div className="absolute inset-0">
        {BEADS.map((b, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.r * 2,
              height: b.r * 2.3,
              background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), rgba(160,190,220,0.12) 45%, transparent 70%)",
            }}
          />
        ))}
      </div>
      {/* Window mullions */}
      <div className="absolute inset-y-0 left-1/3 w-2.5 bg-gradient-to-r from-[#3a2716] to-[#22160c] shadow-lg" />
      <div className="absolute inset-y-0 left-2/3 w-2.5 bg-gradient-to-r from-[#3a2716] to-[#22160c] shadow-lg" />
      <div className="absolute inset-x-0 top-1/2 h-2 bg-gradient-to-b from-[#3a2716] to-[#22160c]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.05)_48%,transparent_56%)]" />
    </div>
  );
}
