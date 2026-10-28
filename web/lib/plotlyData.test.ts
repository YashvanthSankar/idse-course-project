import { describe, expect, it } from "vitest";
import { decodeArray, revealFigure } from "./plotlyData";

const f8 = (values: number[]) => {
  const buf = new Float64Array(values).buffer;
  return { dtype: "f8", bdata: Buffer.from(buf).toString("base64") };
};

describe("decodeArray", () => {
  it("passes plain arrays through", () => {
    expect(decodeArray([1, "a", 3])).toEqual([1, "a", 3]);
  });

  it("decodes little-endian float64 bdata", () => {
    expect(decodeArray(f8([1.5, 49999.99, -2]))).toEqual([1.5, 49999.99, -2]);
  });

  it("decodes int32 bdata", () => {
    const bdata = Buffer.from(new Int32Array([7, -3]).buffer).toString("base64");
    expect(decodeArray({ dtype: "i4", bdata })).toEqual([7, -3]);
  });

  it("returns [] for missing data", () => {
    expect(decodeArray(undefined)).toEqual([]);
  });
});

describe("revealFigure", () => {
  const fig = {
    data: [
      { name: "everyone else", x: ["a", "b"], y: f8([1, 2]) },
      { name: "the fraud", x: ["c", "d", "e"], y: f8([10, 20, 30]), customdata: [[1], [2], [3]] },
    ],
    layout: { title: "How they did it" },
  };

  it("shows only the first n fraud points and decodes every trace", () => {
    const out = revealFigure(fig, 2);
    expect(out.data[0].y).toEqual([1, 2]);
    expect(out.data[1].x).toEqual(["c", "d"]);
    expect(out.data[1].y).toEqual([10, 20]);
    expect(out.data[1].customdata).toEqual([[1], [2]]);
    expect(out.layout).toBe(fig.layout);
  });

  it("counts fraud points", () => {
    expect(revealFigure(fig, 99).fraudCount).toBe(3);
  });
});
