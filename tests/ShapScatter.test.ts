import { describe, expect, it } from "vitest";
import { Plots } from "../react";
import { scatterGeometry } from "../src/react/ShapScatter";
import { parseExplanation } from "../src/core/parse";

const parsed = parseExplanation({
  contract_version: 1,
  values: [[0.1, 0.4], [0.2, 0.1], [-0.3, 0.9], [0.4, 0.2]],
  base_values: 0.5,
  data: [[0, 1], [0.002, 2], [0, 3], [0.5, 4]],
  feature_names: ["Fusobacterium_nucleatum", "Bacteroides_fragilis"],
});

const geometry = (overrides = {}) =>
  scatterGeometry({
    parsed,
    featureIndex: 0,
    width: 600,
    height: 360,
    colorFeature: "auto",
    colorFeatureMinScore: 0.2,
    xScale: "log",
    trend: true,
    ...overrides,
  });

describe("Plots.scatter", () => {
  it("is registered and named", () => {
    expect(Plots.scatter).toBeTypeOf("function");
    expect((Plots.scatter as { displayName?: string }).displayName).toBe("Plots.scatter");
  });
});

describe("scatterGeometry", () => {
  it("places absent Samples left of every detected one", () => {
    const g = geometry();
    const rightmostAbsent = Math.max(...g.absentPoints.map((p) => p.cx));
    const leftmostDetected = Math.min(...g.detectedPoints.map((p) => p.cx));
    expect(rightmostAbsent).toBeLessThan(leftmostDetected);
  });

  it("labels the absent band with its count", () => {
    expect(geometry().absentLabel).toBe("Absent (n = 2)");
  });

  it("omits the absent band when nothing is absent", () => {
    const dense = parseExplanation({
      contract_version: 1,
      values: [[1], [2]],
      base_values: 0,
      data: [[0.3], [0.4]],
      feature_names: ["a"],
    });
    expect(scatterGeometry({
      parsed: dense, featureIndex: 0, width: 600, height: 360,
      colorFeature: "auto", colorFeatureMinScore: 0.2, xScale: "log", trend: true,
    }).absentPoints).toEqual([]);
  });

  it("draws a zero rule inside the plot", () => {
    const g = geometry();
    expect(g.zeroRuleY).toBeGreaterThan(0);
    expect(g.zeroRuleY).toBeLessThan(360);
  });

  it("declines to colour when the strongest interaction is below the threshold", () => {
    const g = geometry({ colorFeatureMinScore: 1.1 });
    expect(g.colorFeatureIndex).toBeNull();
    expect(g.colorNote).toBe("no strong interaction found");
  });

  it("names the colour Feature and its score when it is strong enough", () => {
    const g = geometry({ colorFeatureMinScore: 0 });
    expect(g.colorFeatureIndex).toBe(1);
    expect(g.colorNote).toMatch(/^interaction 0\.\d\d$/);
  });

  it("drops the trend line when asked", () => {
    expect(geometry({ trend: false }).trendPath).toBeNull();
  });
});
