import { useId } from "react";
import { cn } from "@/lib/cn";
import { hashString, mulberry32 } from "@/lib/random";
import type { Suspect } from "@/lib/types";

// A deterministic noir polaroid generated from the suspect's portrait key.
// Everything derives from a seeded PRNG, so server and client render the same SVG.

const BACKDROPS = [
  ["#1d3b45", "#0a1418"], // teal
  ["#4a1f26", "#160a0c"], // burgundy
  ["#2b3242", "#0c0f15"], // slate
  ["#3a3a22", "#12120a"], // olive
  ["#2c2445", "#0d0b16"], // indigo
  ["#4a3320", "#160f09"], // sepia
];
const SKIN = ["#8a5a3c", "#7a4e33", "#9b6a48", "#6b432c", "#a8775a", "#5e3a26"];
const HAIR = ["#0d0907", "#1a120d", "#2a1c14", "#3b3b3b", "#120c0a"];
const CLOTH = ["#1b2333", "#2a1418", "#16241d", "#26201a", "#1d1d24", "#33241b"];
const SAREE = [["#7a1f2b", "#d4a745"], ["#1f4a5a", "#d9b25c"], ["#4d2a5e", "#c99a3e"], ["#2f5a3a", "#e0c070"]];

type Look = {
  backdrop: string[];
  skin: string;
  hair: string;
  cloth: string;
  rim: string;
  lightLeft: boolean;
  pool: "a" | "b";
  hairStyle: number;
  outfit: "saree" | "kurta" | "blazer" | "collar" | "tie" | "suit" | "turtleneck";
  saree: string[];
  glasses: 0 | 1 | 2;
  facial: 0 | 1 | 2;
  bindi: boolean;
  earrings: boolean;
  shoulder: number;
  headW: number;
  tilt: number;
};

function lookFor(key: string, role: string): Look {
  const r = mulberry32(hashString(key));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  // Keys may pin the look family with an "a"/"b" prefix (e.g. "a07"); otherwise it's random.
  const coin = r() < 0.5 ? "a" : "b";
  const pool = key.startsWith("a") ? "a" : key.startsWith("b") ? "b" : coin;
  const ceo = role.toLowerCase() === "ceo";
  const outfitsA = ["saree", "saree", "kurta", "blazer"] as const;
  const outfitsB = ["collar", "tie", "kurta", "turtleneck", "suit"] as const;
  return {
    backdrop: pick(BACKDROPS),
    skin: pick(SKIN),
    hair: pick(HAIR),
    cloth: pick(CLOTH),
    rim: r() < 0.6 ? "#f5a524" : "#4cc9f0",
    lightLeft: r() < 0.5,
    pool,
    hairStyle: Math.floor(r() * 5),
    outfit: ceo ? (pool === "a" ? "blazer" : "suit") : pool === "a" ? pick(outfitsA) : pick(outfitsB),
    saree: pick(SAREE),
    glasses: (r() < 0.35 ? (r() < 0.5 ? 1 : 2) : 0) as Look["glasses"],
    facial: (pool === "b" && r() < 0.55 ? (r() < 0.5 ? 1 : 2) : 0) as Look["facial"],
    bindi: pool === "a" && r() < 0.6,
    earrings: pool === "a" && r() < 0.7,
    shoulder: 0.9 + r() * 0.25,
    headW: 15 + r() * 3,
    tilt: (r() - 0.5) * 6,
  };
}

function Hair({ look, back }: { look: Look; back: boolean }) {
  const { hair, hairStyle, pool, headW } = look;
  const w = headW;
  if (pool === "a") {
    if (back) {
      // Long hair falling behind the shoulders (styles 0-2), bun / ponytail mass (3-4).
      if (hairStyle <= 2) {
        return <path d={`M${50 - w - 4} 40 Q${50 - w - 8} 78 ${50 - w - 2} 92 L${50 + w + 2} 92 Q${50 + w + 8} 78 ${50 + w + 4} 40 Z`} fill={hair} />;
      }
      return hairStyle === 3 ? <circle cx="50" cy="21" r="8.5" fill={hair} /> : <ellipse cx={50 + w + 2} cy="50" rx="5" ry="13" fill={hair} />;
    }
    return (
      <path
        d={
          hairStyle === 1
            ? `M${50 - w - 1} 48 Q${50 - w - 3} 24 50 22 Q${50 + w + 4} 23 ${50 + w + 1} 50 Q${50 + w - 3} 33 ${50 + 4} 30 Q${50 - w + 4} 31 ${50 - w - 1} 48 Z`
            : `M${50 - w - 1} 46 Q${50 - w - 2} 22 50 22 Q${50 + w + 2} 22 ${50 + w + 1} 46 Q${50 + w - 2} 31 50 30 Q${50 - w + 2} 31 ${50 - w - 1} 46 Z`
        }
        fill={hair}
      />
    );
  }
  if (back) return null;
  switch (hairStyle) {
    case 0: // short crop
      return <path d={`M${50 - w} 40 Q${50 - w} 21 50 21 Q${50 + w} 21 ${50 + w} 40 Q${50 + w - 3} 29 50 28 Q${50 - w + 3} 29 ${50 - w} 40 Z`} fill={hair} />;
    case 1: // side part with volume
      return <path d={`M${50 - w - 1} 42 Q${50 - w - 2} 19 ${50 + 3} 19 Q${50 + w + 3} 20 ${50 + w} 40 Q${50 + w - 4} 27 ${50 - 6} 29 Q${50 - w + 1} 31 ${50 - w - 1} 42 Z`} fill={hair} />;
    case 2: // receding / balding
      return <path d={`M${50 - w} 44 Q${50 - w} 32 ${50 - w + 4} 30 L${50 - w + 4} 36 Z M${50 + w} 44 Q${50 + w} 32 ${50 + w - 4} 30 L${50 + w - 4} 36 Z`} fill={hair} />;
    case 3: // curly
      return (
        <g fill={hair}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI + (i / 8) * Math.PI;
            return <circle key={i} cx={50 + Math.cos(a) * (w + 1)} cy={36 + Math.sin(a) * 14} r="5" />;
          })}
        </g>
      );
    default: // slicked back
      return <path d={`M${50 - w} 38 Q${50 - w + 1} 20 50 20 Q${50 + w - 1} 20 ${50 + w} 38 Q${50 + w - 2} 26 50 25 Q${50 - w + 2} 26 ${50 - w} 38 Z`} fill={hair} />;
  }
}

function Outfit({ look, id }: { look: Look; id: string }) {
  const s = look.shoulder;
  const body = `M${50 - 40 * s} 120 Q${50 - 38 * s} 88 ${50 - 14} 80 L${50 + 14} 80 Q${50 + 38 * s} 88 ${50 + 40 * s} 120 Z`;
  const shirt = "#d9d2c3";
  return (
    <g>
      <path d={body} fill={look.cloth} />
      <path d={body} fill={`url(#${id}-cloth)`} />
      {look.outfit === "saree" && (
        <>
          <path d={`M${50 + 13} 80 L${50 + 30} 84 L${50 - 26} 120 L${50 - 44} 120 Z`} fill={look.saree[0]} />
          <path d={`M${50 + 13} 80 L${50 + 16} 81 L${50 - 38} 120 L${50 - 44} 120 Z`} fill={look.saree[1]} opacity="0.9" />
          <path d={`M${50 + 27} 83.5 L${50 + 30} 84 L${50 - 26} 120 L${50 - 29} 120 Z`} fill={look.saree[1]} opacity="0.8" />
        </>
      )}
      {look.outfit === "kurta" && (
        <>
          <path d="M44 80 L50 96 L56 80 Z" fill={look.skin} />
          <path d="M44 80 L50 96 L56 80" fill="none" stroke="#c9a14a" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
        </>
      )}
      {(look.outfit === "collar" || look.outfit === "tie" || look.outfit === "suit" || look.outfit === "blazer") && (
        <>
          <path d="M42 80 L50 94 L58 80 Z" fill={look.outfit === "blazer" ? look.skin : shirt} />
          {look.outfit !== "blazer" && (
            <>
              <path d="M41 79 L47 90 L50 84 Z" fill={shirt} />
              <path d="M59 79 L53 90 L50 84 Z" fill={shirt} />
            </>
          )}
        </>
      )}
      {(look.outfit === "tie" || look.outfit === "suit") && (
        <path d="M48.5 85 L51.5 85 L53 104 L50 108 L47 104 Z" fill={look.outfit === "suit" ? "#7a1f2b" : "#2c3e5a"} />
      )}
      {(look.outfit === "suit" || look.outfit === "blazer") && (
        <>
          <path d={`M${50 - 14} 80 L47 108 L40 120 L${50 - 34 * s} 120 Q${50 - 30 * s} 92 ${50 - 14} 80 Z`} fill="#0b0d12" opacity="0.85" />
          <path d={`M${50 + 14} 80 L53 108 L60 120 L${50 + 34 * s} 120 Q${50 + 30 * s} 92 ${50 + 14} 80 Z`} fill="#0b0d12" opacity="0.85" />
        </>
      )}
      {look.outfit === "turtleneck" && <rect x="41" y="74" width="18" height="10" rx="3" fill={look.cloth} />}
    </g>
  );
}

export function Portrait({ suspect, size = 140, highlight = false, className, caption = true }: {
  suspect: Pick<Suspect, "name" | "role" | "portrait">;
  size?: number;
  highlight?: boolean;
  className?: string;
  caption?: boolean;
}) {
  const raw = useId();
  const id = `p${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const look = lookFor(suspect.portrait, suspect.role);
  const w = look.headW;
  const lx = look.lightLeft ? -1 : 1;

  return (
    <figure
      className={cn(
        "tex-paper relative inline-block shrink-0 rounded-[2px] p-[6%] pb-0 shadow-[0_10px_25px_rgba(0,0,0,0.55)] transition-shadow",
        highlight && "shadow-[0_0_0_3px_var(--red),0_10px_30px_rgba(229,72,77,0.45)]",
        className,
      )}
      style={{ width: size }}
    >
      <svg viewBox="0 0 100 120" className="block w-full" role="img" aria-label={`Photo of ${suspect.name}`}>
        <defs>
          <radialGradient id={`${id}-bg`} cx={look.lightLeft ? "30%" : "70%"} cy="30%" r="85%">
            <stop offset="0%" stopColor={look.backdrop[0]} />
            <stop offset="100%" stopColor={look.backdrop[1]} />
          </radialGradient>
          <linearGradient id={`${id}-face`} x1={look.lightLeft ? "0" : "1"} y1="0" x2={look.lightLeft ? "1" : "0"} y2="0.3">
            <stop offset="0%" stopColor={look.skin} />
            <stop offset="55%" stopColor={look.skin} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0b0806" />
          </linearGradient>
          <linearGradient id={`${id}-cloth`} x1={look.lightLeft ? "0" : "1"} y1="0" x2={look.lightLeft ? "1" : "0"} y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id={`${id}-vig`} cx="50%" cy="45%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
          </radialGradient>
          <filter id={`${id}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed={hashString(suspect.portrait) % 97} />
            <feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.18 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <filter id={`${id}-soft`}>
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>

        <rect width="100" height="120" fill={`url(#${id}-bg)`} />
        {/* Venetian-blind light across the wall: the noir signature */}
        <g opacity="0.08" transform={`rotate(${look.lightLeft ? -18 : 18} 50 60)`}>
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x="-40" y={i * 18} width="180" height="7" fill="#fff" />
          ))}
        </g>

        <g transform={`rotate(${look.tilt} 50 70)`}>
          {/* Rim light: the silhouette offset toward the light, blurred, behind the figure */}
          <g transform={`translate(${-lx * 1.6} -0.6)`} filter={`url(#${id}-soft)`} opacity="0.9">
            <ellipse cx="50" cy="48" rx={w + 1} ry="21" fill={look.rim} />
            <path d={`M${50 - 40 * look.shoulder} 120 Q${50 - 38 * look.shoulder} 87 ${50 - 14} 79 L${50 + 14} 79 Q${50 + 38 * look.shoulder} 87 ${50 + 40 * look.shoulder} 120 Z`} fill={look.rim} />
          </g>
          <Hair look={look} back />
          <rect x="44" y="62" width="12" height="20" rx="4" fill={look.skin} />
          <rect x="44" y="62" width="12" height="20" rx="4" fill="#000" opacity="0.35" />
          <Outfit look={look} id={id} />
          {/* Head */}
          <ellipse cx="50" cy="48" rx={w} ry="20" fill={`url(#${id}-face)`} />
          {/* Ears */}
          <ellipse cx={50 - w} cy="50" rx="2.6" ry="4.5" fill={look.skin} opacity="0.85" />
          <ellipse cx={50 + w} cy="50" rx="2.6" ry="4.5" fill={look.skin} opacity="0.6" />
          {look.earrings && (
            <>
              <circle cx={50 - w} cy="56.5" r="1.4" fill="#e0b84f" />
              <circle cx={50 + w} cy="56.5" r="1.4" fill="#e0b84f" opacity="0.7" />
            </>
          )}
          {/* Features: low-contrast, lit from the rim side */}
          <ellipse cx={50 - 6} cy="48" rx="2.4" ry="1.3" fill="#120c09" opacity="0.8" />
          <ellipse cx={50 + 6} cy="48" rx="2.4" ry="1.3" fill="#120c09" opacity="0.8" />
          <circle cx={50 - 6 + lx * -0.6} cy="47.7" r="0.45" fill="#fff" opacity="0.7" />
          <circle cx={50 + 6 + lx * -0.6} cy="47.7" r="0.45" fill="#fff" opacity="0.7" />
          <path d={`M${50 - 9} 44 Q${50 - 6} 42.5 ${50 - 3} 44`} stroke={look.hair} strokeWidth="1.1" fill="none" />
          <path d={`M${50 + 3} 44 Q${50 + 6} 42.5 ${50 + 9} 44`} stroke={look.hair} strokeWidth="1.1" fill="none" />
          <path d={`M${50 + lx * -0.5} 49 L${50 + lx * 1.8} 56 L${50 - 1.5} 56.6`} stroke="#000" strokeOpacity="0.35" strokeWidth="0.9" fill="none" />
          <path d="M45.5 61 Q50 62.6 54.5 61" stroke="#2a1510" strokeWidth="1" fill="none" opacity="0.8" />
          {look.bindi && <circle cx="50" cy="41.5" r="0.95" fill="#b3122a" />}
          {look.facial === 1 && <path d="M45 59.2 Q50 57.2 55 59.2 Q50 60.2 45 59.2 Z" fill={look.hair} />}
          {look.facial === 2 && (
            <path d={`M${50 - w + 2} 52 Q${50 - w + 3} 66 50 69 Q${50 + w - 3} 66 ${50 + w - 2} 52 Q${50 + w - 4} 60 50 63 Q${50 - w + 4} 60 ${50 - w + 2} 52 Z`} fill={look.hair} opacity="0.92" />
          )}
          {look.glasses === 1 && (
            <g stroke="#0a0a0a" strokeWidth="1" fill="#9fd3e6" fillOpacity="0.08">
              <circle cx={50 - 6} cy="48" r="4" />
              <circle cx={50 + 6} cy="48" r="4" />
              <path d="M48 47.5 L52 47.5" />
            </g>
          )}
          {look.glasses === 2 && (
            <g stroke="#0a0a0a" strokeWidth="1.2" fill="#9fd3e6" fillOpacity="0.08">
              <rect x={50 - 10.5} y="45" width="8.5" height="5.5" rx="1" />
              <rect x={50 + 2} y="45" width="8.5" height="5.5" rx="1" />
              <path d="M48 47 L52 47" />
            </g>
          )}
          <Hair look={look} back={false} />
        </g>

        <rect width="100" height="120" fill={`url(#${id}-vig)`} />
        <rect width="100" height="120" filter={`url(#${id}-grain)`} />
      </svg>
      {caption ? (
        <figcaption className="truncate px-0.5 pb-[5%] pt-[4%] text-center font-type leading-tight" style={{ fontSize: Math.max(10, size * 0.085) }}>
          {suspect.name}
        </figcaption>
      ) : (
        <div style={{ height: size * 0.12 }} />
      )}
    </figure>
  );
}
