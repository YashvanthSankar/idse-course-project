import { describe, expect, it } from "vitest";
import { appraisalSeen, formatSalary, loadCareerCode, markAppraisalSeen, normaliseCode, saveCareerCode } from "./career";

const mem = () => {
  const d = new Map<string, string>();
  return {
    getItem: (k: string) => d.get(k) ?? null,
    setItem: (k: string, v: string) => void d.set(k, v),
    removeItem: (k: string) => void d.delete(k),
  };
};

describe("career", () => {
  it("formats salaries in lakh and crore", () => {
    expect(formatSalary(6)).toBe("₹6 LPA");
    expect(formatSalary(18.75)).toBe("₹18.75 LPA");
    expect(formatSalary(9)).toBe("₹9 LPA");
    expect(formatSalary(150)).toBe("₹1.5 Cr");
    expect(formatSalary(187.5)).toBe("₹1.88 Cr");
    expect(formatSalary(500)).toBe("₹5 Cr");
  });

  it("normalises typed career codes", () => {
    expect(normaliseCode("abc def")).toBe("ABC-DEF");
    expect(normaliseCode("k7q-3mx")).toBe("K7Q-3MX");
    expect(normaliseCode("ab")).toBe("AB");
  });

  it("remembers this browser's career code", () => {
    const kv = mem();
    expect(loadCareerCode(kv)).toBeNull();
    saveCareerCode("ABC-DEF", kv);
    expect(loadCareerCode(kv)).toBe("ABC-DEF");
    saveCareerCode(null, kv);
    expect(loadCareerCode(kv)).toBeNull();
  });

  it("shows each appraisal once", () => {
    const kv = mem();
    expect(appraisalSeen("ABC-DEF", 0, kv)).toBe(false);
    markAppraisalSeen("ABC-DEF", 0, kv);
    expect(appraisalSeen("ABC-DEF", 0, kv)).toBe(true);
    expect(appraisalSeen("ABC-DEF", 1, kv)).toBe(false);
  });
});
