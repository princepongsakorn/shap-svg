import { describe, expect, it } from "vitest";
import { Plots } from "../react";
import { scatterGeometry } from "../src/react/ShapScatter";
import { parseExplanation } from "../src/core/parse";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShapScatter } from "../src/react/ShapScatter";

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
    const sampleCount = 40;
    const strong = parseExplanation({
      contract_version: 1,
      values: Array.from({ length: sampleCount }, (_, i) => [i % 4, 0, 0]),
      base_values: 0,
      data: Array.from({ length: sampleCount }, (_, i) => [i, i % 4, (i * 7) % 11]),
      feature_names: ["plotted", "Tracking_feature", "noise"],
    });
    const g = geometry({ parsed: strong, colorFeatureMinScore: 0.1 });
    expect(g.colorFeatureIndex).toBe(1);
    expect(g.colorFeatureLabel).toBe("Tracking feature");
    expect(g.colorNote).toMatch(/^interaction \d\.\d\d$/);
    expect(Number(g.colorNote.match(/(\d+\.\d+)$/)?.[1])).toBeGreaterThan(0);
  });

  it("draws the selected Feature name and honours the colour-bar switch", () => {
    const props = {
      explanation: {
        contract_version: 1 as const,
        values: [[0.1, 0], [0.2, 0]],
        base_values: 0,
        data: [[1, 2], [2, 3]],
        feature_names: ["plotted", "Colour_feature"],
      },
      feature: 0,
      colorFeature: 1,
    };
    const withBar = renderToStaticMarkup(createElement(ShapScatter, { ...props, colorBar: true }));
    const withoutBar = renderToStaticMarkup(createElement(ShapScatter, { ...props, colorBar: false }));

    expect(withBar).toContain("Colour feature");
    expect(withBar).toContain('aria-label="Feature value: Low to High"');
    expect(withoutBar).not.toContain('aria-label="Feature value: Low to High"');
  });

  it("drops the trend line when asked", () => {
    expect(geometry({ trend: false }).trendPath).toBeNull();
  });
});
