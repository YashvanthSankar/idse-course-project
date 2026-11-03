import { describe, expect, it } from "vitest";
import { fits, proofOf, roleOf, settingOf } from "./proof";
import type { Theory, ToolResult } from "./types";

const THEORIES: Record<string, Theory> = {
  duplicates: { id: "duplicates", name: "Billed twice", fits: [{ tool: "duplicates", setting: null }] },
  under_limit: {
    id: "under_limit",
    name: "Just under the approval limit",
    fits: [{ tool: "groupby", setting: "vendor" }, { tool: "isoforest", setting: null }],
  },
  weekend: {
    id: "weekend",
    name: "Weekend payments",
    fits: [{ tool: "timeseries", setting: null }, { tool: "groupby", setting: "weekday" }],
  },
};

const clue = (tool_id: ToolResult["tool_id"], implicates: string[], params: Record<string, string> = {}) =>
  ({ result_id: `${tool_id}-${implicates.join("")}`, tool_id, params, implicates }) as unknown as ToolResult;

describe("proof", () => {
  it("one clue that fits your theory and names them proves it", () => {
    expect(proofOf("E2", THEORIES.duplicates, [clue("duplicates", ["E2"])])).toBe("proven");
  });

  it("a clue that doesn't fit is only a lead", () => {
    expect(proofOf("E2", THEORIES.duplicates, [clue("zscore", ["E2"])])).toBe("lead");
    expect(proofOf("E2", null, [clue("duplicates", ["E2"])])).toBe("lead");
  });

  it("two different tools agreeing prove it, whatever the theory", () => {
    expect(proofOf("E2", THEORIES.duplicates, [clue("zscore", ["E2"]), clue("iqr_box", ["E2"])])).toBe("proven");
  });

  it("a clue naming two people singles out nobody, unless two fraudsters share the ledger", () => {
    expect(proofOf("E2", THEORIES.duplicates, [clue("duplicates", ["E2", "E4"])])).toBe("lead");
    expect(proofOf("E2", THEORIES.duplicates, [clue("duplicates", ["E2", "E4"])], 2)).toBe("proven");
  });

  it("a clue that points at half the company proves nothing", () => {
    expect(proofOf("E2", THEORIES.duplicates, [clue("duplicates", ["E1", "E2", "E3"])])).toBe("lead");
    expect(proofOf("E2", THEORIES.duplicates, [clue("duplicates", ["E1"])])).toBe("none");
  });

  it("the setting decides whether Pattern Matrix fits", () => {
    expect(fits(clue("groupby", ["E2"], { by: "vendor" }), THEORIES.under_limit)).toBe(true);
    expect(fits(clue("groupby", ["E2"], { by: "category" }), THEORIES.under_limit)).toBe(false);
    expect(fits(clue("groupby", ["E2"]), THEORIES.weekend)).toBe(true); // weekday is the default
    expect(settingOf(clue("zscore", []))).toBe("per_employee");
  });

  it("labels each tool by what it can do", () => {
    expect(roleOf("duplicates")).toBe("proves");
    expect(roleOf("zscore", "per_employee")).toBe("screens");
    expect(roleOf("groupby", "vendor")).toBe("proves");
    expect(roleOf("groupby", "category")).toBe("screens");
    expect(roleOf("summary")).toBe("screens");
  });
});
