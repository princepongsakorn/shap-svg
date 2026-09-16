import { describe, expect, it } from "vitest";
import { shapPca } from "../src/core/pca";

/** Points on a line through the origin: all variance belongs to one component. */
const collinear = [
  [-2, -4],
  [-1, -2],
  [0, 0],
  [1, 2],
  [2, 4],
];

describe("shapPca", () => {
  it("puts all variance in the first component when the data is collinear", () => {
    const { varianceRatios } = shapPca(collinear);
    expect(varianceRatios[0]).toBeCloseTo(1, 6);
    expect(varianceRatios[1]).toBeCloseTo(0, 6);
  });

  it("spreads collinear points along the first axis and flattens the second", () => {
    const { coords } = shapPca(collinear);
    const spread = (i: 0 | 1) => Math.max(...coords.map((c) => c[i])) - Math.min(...coords.map((c) => c[i]));
    expect(spread(0)).toBeGreaterThan(8);
    expect(spread(1)).toBeCloseTo(0, 6);
  });

  it("centres the projection, so the coordinates sum to zero", () => {
    const { coords } = shapPca(collinear);
    expect(coords.reduce((sum, c) => sum + c[0], 0)).toBeCloseTo(0, 6);
  });

  it("gives the same answer every call", () => {
    const first = shapPca(collinear);
    const second = shapPca(collinear);
    expect(second.coords).toEqual(first.coords);
  });

  it("fixes the sign so the largest loading is positive", () => {
    const flipped = collinear.map(([a, b]) => [-a, -b]);
    const a = shapPca(collinear).coords;
    const b = shapPca(flipped).coords;
    expect(b[0][0]).toBeCloseTo(-a[0][0], 6);
  });

  it("returns zeroed coordinates when every Sample is identical", () => {
    const { coords, varianceRatios } = shapPca([[1, 1], [1, 1], [1, 1]]);
    expect(coords).toEqual([[0, 0], [0, 0], [0, 0]]);
    expect(varianceRatios).toEqual([0, 0]);
  });
});
