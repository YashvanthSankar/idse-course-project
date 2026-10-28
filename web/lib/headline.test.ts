import { describe, expect, it } from "vitest";
import { finding } from "./headline";

const names = { E1: "Vikram Kapoor", E2: "Siddharth Joshi", E3: "Divya Menon", E4: "Varun Reddy" };
const r = (tool_id: string, implicates: string[], stats: Record<string, number | string> = {}) => ({
  tool_id, implicates, stats, summary: "Some long sentence. Flagged: E2.",
});

describe("finding", () => {
  it("one suspect: red pill with first name and a tool-specific headline", () => {
    const f = finding(r("zscore", ["E2"], { flagged_E2: 2 }), names);
    expect(f.tone).toBe("guilty");
    expect(f.pill).toBe("Points at Siddharth");
    expect(f.headline).toBe("2 claims far outside Siddharth's normal");
  });

  it("two suspects are joined with an ampersand", () => {
    const f = finding(r("benford", ["E2", "E3"]), names);
    expect(f.pill).toBe("Points at Siddharth & Divya");
    expect(f.headline).toBe("Siddharth & Divya's first digits don't look like real money");
  });

  it("nobody: grey pill", () => {
    const f = finding(r("duplicates", []), names);
    expect(f.tone).toBe("clear");
    expect(f.pill).toBe("Nobody stands out");
    expect(f.headline).toBe("No receipt was billed twice");
  });

  it("three or more: amber weak pill", () => {
    const f = finding(r("zscore", ["E1", "E2", "E3"]), names);
    expect(f.tone).toBe("weak");
    expect(f.pill).toBe("Points at 3 people — weak");
    expect(f.headline).toBe("3 people stand out — too many to prove anything");
  });

  it("summary tool never accuses and uses its own headline", () => {
    const f = finding(r("summary", [], { total_spend: 1234567 }), names);
    expect(f.tone).toBe("info");
    expect(f.pill).toBe("Overview only");
    expect(f.headline).toMatch(/^₹12,34,567 spent/);
  });

  it("detail line drops the name list the pill already shows, keeps the method", () => {
    const d = (summary: string) => finding({ ...r("zscore", ["E2"]), summary }, names).detail;
    expect(d("2 claim(s) more than 3 sd from their normal. Flagged: E2.")).toBe("2 claim(s) more than 3 sd from their normal.");
    expect(d("8 twin pairs within 7 days. Repeat offenders: E2, E3.")).toBe("8 twin pairs within 7 days.");
    expect(d("Real money starts with a 1. Ledgers that break the pattern (chi-square p < 0.00001): E2.")).toBe(
      "Real money starts with a 1. Ledgers that break the pattern (chi-square p < 0.00001).",
    );
    expect(d("Typical employee files 2% on weekends. Card active while the office sleeps: nobody unusual.")).toBe(
      "Typical employee files 2% on weekends. Card active while the office sleeps.",
    );
    expect(d("Stands out: E2 — a weekday pattern unlike everyone else's (chi-square p < 0.001).")).toBe(
      "A weekday pattern unlike everyone else's (chi-square p < 0.001).",
    );
  });

  it("summary detail keeps names, swapped for first names", () => {
    const f = finding({ ...r("summary", []), summary: "Biggest spender: E1 with ₹9." }, names);
    expect(f.detail).toBe("Biggest spender: Vikram with ₹9.");
  });
});
