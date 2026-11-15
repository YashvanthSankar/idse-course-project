import { describe, expect, it } from "vitest";
import { revealShift } from "./Podium";

describe("revealShift", () => {
  it("starts the reveal with the lowest place that has a winner", () => {
    expect(revealShift(1)).toBe(2.4);
    expect(revealShift(2)).toBe(1.2);
    expect(revealShift(3)).toBe(0);
  });

  it("works when more players win than there are places", () => {
    expect(revealShift(4)).toBe(0);
    expect(revealShift(30)).toBe(0);
  });
});
