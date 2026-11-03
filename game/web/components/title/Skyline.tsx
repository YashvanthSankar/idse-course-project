"use client";
import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useMemo } from "react";
import { mulberry32 } from "@/lib/random";

type Building = { x: number; w: number; h: number; windows: { x: number; y: number; c: string }[]; antenna: boolean };

function makeLayer(seed: number, count: number, minH: number, maxH: number, litChance: number): Building[] {
  const rnd = mulberry32(seed);
  const out: Building[] = [];
  let x = -40;
  for (let i = 0; i < count && x < 1640; i++) {
    const w = 40 + rnd() * 90;
    const h = minH + rnd() * (maxH - minH);
    const windows: Building["windows"] = [];
    for (let wy = 14; wy < h - 10; wy += 16) {
      for (let wx = 8; wx < w - 8; wx += 13) {
        if (rnd() < litChance) {
          windows.push({ x: x + wx, y: 600 - h + wy, c: rnd() < 0.85 ? "#f5a524" : "#4cc9f0" });
        }
      }
    }
    out.push({ x, w, h, windows, antenna: rnd() < 0.25 });
    x += w + rnd() * 6;
  }
  return out;
}

function Layer({ buildings, fill, depth, mx, windowOpacity }: {
  buildings: Building[];
  fill: string;
  depth: number;
  mx: MotionValue<number>;
  windowOpacity: number;
}) {
  const x = useTransform(mx, (v) => v * depth);
  return (
    <motion.g style={{ x }}>
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={600 - b.h} width={b.w} height={b.h} fill={fill} />
          {b.antenna && (
            <>
              <rect x={b.x + b.w / 2 - 1} y={600 - b.h - 30} width={2} height={30} fill={fill} />
              <circle cx={b.x + b.w / 2} cy={600 - b.h - 31} r={2.2} fill="#e5484d" className="animate-blink" />
            </>
          )}
          {b.windows.map((w, j) => (
            <rect key={j} x={w.x} y={w.y} width={6} height={8} fill={w.c} opacity={windowOpacity} />
          ))}
        </g>
      ))}
    </motion.g>
  );
}

/** Three parallax layers of Mumbai high-rises at 2 AM, mirrored into a rain puddle. */
export function Skyline({ pointerX }: { pointerX: MotionValue<number> }) {
  const mx = useSpring(pointerX, { stiffness: 60, damping: 20 });
  const far = useMemo(() => makeLayer(11, 40, 120, 300, 0.05), []);
  const mid = useMemo(() => makeLayer(23, 32, 160, 380, 0.12), []);
  const near = useMemo(() => makeLayer(37, 24, 90, 230, 0.16), []);

  const scene = (
    <>
      <Layer buildings={far} fill="#0f1420" depth={-8} mx={mx} windowOpacity={0.35} />
      <Layer buildings={mid} fill="#0a0d15" depth={-18} mx={mx} windowOpacity={0.6} />
      <Layer buildings={near} fill="#05070b" depth={-32} mx={mx} windowOpacity={0.85} />
    </>
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%]">
      <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" className="absolute bottom-[22%] h-[78%] w-full">
        {scene}
      </svg>
      {/* Puddle reflection */}
      <svg
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMax slice"
        className="absolute bottom-0 h-[22%] w-full -scale-y-100 opacity-40 blur-[1.5px]"
        style={{ maskImage: "linear-gradient(to top, transparent, black 85%)" }}
      >
        {scene}
      </svg>
      <div className="absolute inset-x-0 bottom-[22%] h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
    </div>
  );
}
