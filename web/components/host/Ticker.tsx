"use client";
import { AnimatePresence, motion } from "framer-motion";

export function Ticker({ lines }: { lines: { id: number; text: string }[] }) {
  return (
    <ul className="space-y-2" data-testid="ticker">
      <AnimatePresence initial={false}>
        {lines.map((line, i) => (
          <motion.li
            key={line.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1 - i * 0.15, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xl text-paper"
          >
            <span className="mr-2 text-cyan">›</span>
            {line.text}
          </motion.li>
        ))}
      </AnimatePresence>
      {lines.length === 0 && <li className="text-xl text-paper/40">Quiet… for now.</li>}
    </ul>
  );
}
