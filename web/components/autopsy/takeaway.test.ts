import { describe, expect, it } from "vitest";
import { formatSeconds, takeaway } from "./takeaway";

describe("formatSeconds", () => {
  it("formats minutes and seconds", () => {
    expect(formatSeconds(220)).toBe("3m 40s");
    expect(formatSeconds(45)).toBe("45s");
    expect(formatSeconds(Number.NaN)).toBe("—");
  });
});

describe("takeaway", () => {
  it("summarises each slide in one line", () => {
    expect(takeaway("The verdicts", { solve_rate: 0.62, median_seconds: 220, players: 30 })).toBe(
      "62% caught the fraudster · median 3m 40s",
    );
    expect(takeaway("Which tools did the class reach for?", { most_used: "Z-Score Scan", total_runs: 140 })).toBe(
      "Z-Score Scan was the go-to tool · 140 runs in total",
    );
    expect(takeaway("Does more analysis pay off?", { pearson_r: 0.41, p_value: 0.001 })).toBe(
      "Yes — more tools, more truth (r = 0.41, p = 0.001)",
    );
    expect(takeaway("Does more analysis pay off?", { pearson_r: 0.05, p_value: 0.6 })).toBe(
      "Not clearly — effort alone didn't decide it (r = 0.05, p = 0.6)",
    );
    expect(takeaway("Which tool predicts success?", { best_tool: "Benford's Law", best_p: 0.02 })).toBe(
      "Benford's Law separated winners from the rest (p = 0.02)",
    );
    expect(takeaway("Detective archetypes", { "The Gambler": 3, "The Statistician": 9 })).toBe(
      "Mostly The Statistician — 9 of 12 detectives",
    );
    expect(takeaway("No detectives yet", {})).toBe("Play a round first — then the class becomes the dataset.");
  });
});
