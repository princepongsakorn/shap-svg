import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { decisionLayout } from "../src/core/decisionLayout";

const parsed = parseExplanation({
  contract_version: 1,
  values: [
    [0.30, -0.10, 0.02],
    [-0.20, 0.05, -0.01],
  ],
  base_values: 0.5,
  data: [[1, 2, 3], [4, 5, 6]],
  feature_names: ["big", "middle", "small"],
});

const layout = (overrides = {}) =>
  decisionLayout({ parsed, width: 600, rowHeight: 28, maxDisplay: 3, ...overrides });

describe("decisionLayout", () => {
  it("orders rows with the least important Feature at the bottom", () => {
    expect(layout().rowLabels).toEqual(["small", "middle", "big"]);
  });

  it("starts every path at the Base value when all Features are shown", () => {
    for (const path of layout().paths) {
      expect(path.values[0]).toBeCloseTo(0.5, 12);
    }
  });

  it("ends every path at the Model output", () => {
    const [first, second] = layout().paths;
    expect(first.values[first.values.length - 1]).toBeCloseTo(0.5 + 0.22, 12);
    expect(second.values[second.values.length - 1]).toBeCloseTo(0.5 - 0.16, 12);
  });

  it("folds hidden Features into where the path starts, with no extra row", () => {
    const l = layout({ maxDisplay: 2 });
    expect(l.rowLabels).toEqual(["middle", "big"]);
    // 'small' is hidden, so path 0 starts at 0.5 + 0.02.
    expect(l.paths[0].values[0]).toBeCloseTo(0.52, 12);
    expect(l.paths[0].values).toHaveLength(3);
  });

  it("makes the x limits symmetric about the Base value in both directions", () => {
    const [low, high] = layout().xDomain;
    expect(0.5 - low).toBeCloseTo(high - 0.5, 12);
  });

  it("stays symmetric when the paths run further below the Base value", () => {
    const belowHeavy = parseExplanation({
      contract_version: 1,
      values: [[-0.4], [0.05]],
      base_values: 0.5,
      data: [[1], [2]],
      feature_names: ["only"],
    });
    const [low, high] = decisionLayout({
      parsed: belowHeavy, width: 600, rowHeight: 28, maxDisplay: 1,
    }).xDomain;
    expect(0.5 - low).toBeCloseTo(high - 0.5, 12);
  });

  it("draws only the Samples it is asked for", () => {
    expect(layout({ sampleIndices: [1] }).paths.map((p) => p.sampleIndex)).toEqual([1]);
  });

  it("centres on the mean selected Base value regardless of Sample order", () => {
    const varyingBases = parseExplanation({
      contract_version: 1,
      values: [[0.2], [-0.1]],
      base_values: [0.2, 0.8],
      data: [[1], [2]],
      feature_names: ["only"],
    });
    const forward = decisionLayout({
      parsed: varyingBases, width: 600, rowHeight: 28, maxDisplay: 1, sampleIndices: [0, 1],
    });
    const reversed = decisionLayout({
      parsed: varyingBases, width: 600, rowHeight: 28, maxDisplay: 1, sampleIndices: [1, 0],
    });

    expect(forward.baseValue).toBeCloseTo(0.5, 12);
    expect(reversed.baseValue).toBeCloseTo(0.5, 12);
    expect(reversed.xDomain).toEqual(forward.xDomain);
  });

  it("thins the strokes as the Sample count grows", () => {
    const few = layout().pathOpacity;
    const many = decisionLayout({
      parsed, width: 600, rowHeight: 28, maxDisplay: 3,
      sampleIndices: Array.from({ length: 500 }, () => 0),
    }).pathOpacity;
    expect(many).toBeLessThan(few);
    expect(many).toBeGreaterThan(0);
  });
});
