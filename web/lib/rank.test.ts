import { describe, expect, it } from "vitest";
import { rankFor } from "./rank";

describe("detective ranks", () => {
  it("everyone starts as a Rookie", () => {
    expect(rankFor(0)).toMatchObject({ title: "Rookie", next: "Constable", toNext: 1500 });
  });
  it("climbs with the total of best scores", () => {
    expect(rankFor(1500).title).toBe("Constable");
    expect(rankFor(4200).title).toBe("Sub-Inspector");
    expect(rankFor(7000).title).toBe("Inspector");
  });
  it("tops out at Chief Inspector", () => {
    expect(rankFor(99999)).toMatchObject({ title: "Chief Inspector", next: null, toNext: 0 });
  });
  it("reports progress towards the next rank", () => {
    expect(rankFor(2750).progress).toBeCloseTo(0.5, 2);
  });
});
