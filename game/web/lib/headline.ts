import { formatINR, withNames } from "./format";

export type Tone = "guilty" | "weak" | "clear" | "info";
export type Finding = { headline: string; pill: string; tone: Tone; detail: string };
type ResultLike = {
  tool_id: string;
  implicates: string[];
  stats: Record<string, number | string>;
  summary: string;
};

const first = (names: Record<string, string>, id: string) => names[id]?.split(" ")[0] ?? id;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What each tool concluded, in one sentence a player can read at a glance.
const ACCUSE: Record<string, (who: string, n: number) => string> = {
  zscore: (who, n) => `${plural(n, "claim")} far outside ${who}'s normal`,
  iqr_box: (who) => `${who} has a claim beyond the far-out fence`,
  duplicates: (who, n) => `${who} billed the same receipt twice${n ? ` — ${plural(n, "time")}` : ""}`,
  benford: (who) => `${who}'s first digits don't look like real money`,
  timeseries: (who) => `${who} keeps spending while the office is shut`,
  regression: (who) => `${who}'s expenses sit far above the deal line`,
  isoforest: (who) => `${who} owns the strangest claims in the ledger`,
  groupby: (who) => `${who}'s habits differ from everyone else's`,
};
const QUIET: Record<string, string> = {
  zscore: "No claim is far outside its owner's normal",
  iqr_box: "Every claim sits inside its owner's fences",
  duplicates: "No receipt was billed twice",
  benford: "Every ledger's digits look like real money",
  timeseries: "Nobody's spending stands out on weekends",
  regression: "Everyone's expenses track their deals",
  isoforest: "The forest found nothing out of place",
  groupby: "Nobody's habits stand out from the pack",
};

/** Count of flagged items for the implicated people, from stats like flagged_E2 / pairs_E2. */
function countFor(stats: ResultLike["stats"], ids: string[]): number {
  return ids.reduce((sum, id) => {
    const v = stats[`flagged_${id}`] ?? stats[`pairs_${id}`];
    return sum + (typeof v === "number" ? v : 0);
  }, 0);
}

const WHO = String.raw`(?:E\d+(?:, E\d+)*|nobody(?: unusual)?|none)`;

/** The "how we know" line: the tool's own sentence minus the name list the pill already shows. */
function howWeKnow(summary: string): string {
  let s = summary.replace(new RegExp(String.raw`^Stands out: ${WHO} — `), "");
  s = s.replace(new RegExp(String.raw`\s*(?:Flagged|Repeat offenders): ${WHO}\.?$`), "");
  s = s.replace(new RegExp(String.raw`:\s*${WHO}\.?$`), ".");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// When a tool flags nobody, its own sentence still describes the flagged case: say what it checked.
const QUIET_DETAIL: Record<string, string> = {
  groupby: "Everyone's mix was compared with the rest of the office (chi-square): nobody's was different enough.",
  timeseries: "Weekend spending was compared with weekdays for everyone (binomial test): nobody's stood out.",
  benford: "Every ledger's first digits were tested against Benford's law: none broke the pattern.",
};

/** The summary's rupee amounts in the same Indian grouping as the headline (₹1,88,08,902). */
const indianRupees = (text: string) =>
  text.replace(/₹([\d,]+(?:\.\d+)?)/g, (_, n: string) => formatINR(Number(n.replace(/,/g, ""))));

export function finding(result: ResultLike, names: Record<string, string>): Finding {
  const ids = result.implicates;
  const detail =
    result.tool_id === "summary"
      ? indianRupees(withNames(result.summary, names))
      : ids.length === 0 && QUIET_DETAIL[result.tool_id]
        ? QUIET_DETAIL[result.tool_id]
        : howWeKnow(result.summary);
  if (result.tool_id === "summary") {
    const total = Number(result.stats.total_spend ?? 0);
    return { headline: `${formatINR(total)} spent across the ledger`, pill: "Overview only", tone: "info", detail };
  }
  if (ids.length === 0) {
    return { headline: QUIET[result.tool_id] ?? "Nobody stands out", pill: "Nobody stands out", tone: "clear", detail };
  }
  if (ids.length > 2) {
    return {
      headline: `${ids.length} people stand out — too many to prove anything`,
      pill: `Points at ${ids.length} people — weak`,
      tone: "weak",
      detail,
    };
  }
  const who = ids.map((id) => first(names, id)).join(" & ");
  const make = ACCUSE[result.tool_id] ?? ((w: string) => `${w} stands out`);
  return { headline: make(who, countFor(result.stats, ids)), pill: `Points at ${who}`, tone: "guilty", detail };
}
