import { describe, expect, it } from "vitest";
import { formatDuration, formatINR, formatStat, keyStats } from "./format";

describe("format", () => {
  it("formats rupees in the Indian grouping", () => {
    expect(formatINR(1234567.891)).toBe("₹12,34,568");
    expect(formatINR(99.5, 2)).toBe("₹99.50");
  });

  it("formats durations as mm:ss and h:mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("formats stats: tiny p-values in scientific, shares as %, ints plain", () => {
    expect(formatStat("p_E1", 1.6e-23)).toBe("1.6e-23");
    expect(formatStat("p_E2", 0.6463)).toBe("0.646");
    expect(formatStat("weekend_share_E1", 0.072)).toBe("7.2%");
    expect(formatStat("flagged_rows", 3)).toBe("3");
    expect(formatStat("scope", "per_employee")).toBe("per employee");
  });

  it("keyStats prefers stats about implicated suspects and caps the count", () => {
    const stats = { n_rows: 1000, p_E1: 0.5, p_E4: 1e-9, flagged_E4: 2, total: 5 };
    const picked = keyStats(stats, ["E4"], 3).map(([k]) => k);
    expect(picked.slice(0, 2)).toEqual(["p_E4", "flagged_E4"]);
    expect(picked).toHaveLength(3);
  });
});

describe("withNames", () => {
  it("replaces suspect ids with first names, leaving other text alone", async () => {
    const { withNames } = await import("./format");
    const names = { E1: "Priya Nair", E4: "Aditya Banerjee" };
    expect(withNames("Flagged: E4, E1. E12 unknown", names)).toBe("Flagged: Aditya, Priya. E12 unknown");
  });
});

describe("statName", () => {
  const names = { E2: "Siddharth Joshi", E4: "Aditya Banerjee" };
  it("swaps a trailing suspect id for the first name", async () => {
    const { statName } = await import("./format");
    expect(statName("p_E2", names)).toBe("p · Siddharth");
    expect(statName("flagged_share_E4", names)).toBe("flagged share · Aditya");
  });
  it("leaves other keys readable", async () => {
    const { statName } = await import("./format");
    expect(statName("flagged_rows", names)).toBe("flagged rows");
    expect(statName("p_E9", names)).toBe("p · E9");
  });
});
