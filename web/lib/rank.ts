// A career for the player: the total of their best case scores earns a rank.
const RANKS = [
  { title: "Rookie", at: 0 },
  { title: "Constable", at: 1500 },
  { title: "Sub-Inspector", at: 4000 },
  { title: "Inspector", at: 7000 },
  { title: "Chief Inspector", at: 10000 },
] as const;

export type Rank = { title: string; next: string | null; toNext: number; progress: number };

export function rankFor(total: number): Rank {
  let i = 0;
  while (i + 1 < RANKS.length && total >= RANKS[i + 1].at) i++;
  const here = RANKS[i];
  const next = RANKS[i + 1];
  if (!next) return { title: here.title, next: null, toNext: 0, progress: 1 };
  return {
    title: here.title,
    next: next.title,
    toNext: next.at - total,
    progress: (total - here.at) / (next.at - here.at),
  };
}
