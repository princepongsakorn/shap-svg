import { describe, expect, it } from "vitest";
import { Plots } from "../react";
import { scatterGeometry } from "../src/react/ShapScatter";
import { parseExplanation } from "../src/core/parse";
import { resolveLabels, shapLabels } from "../src/core/labels";
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
    expect(geometry().absentLabelLines.join(" ")).toBe("Absent (n = 2)");
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

  it("creates y ticks that cover SHAP values from absent and detected Samples", () => {
    const g = geometry();
    expect(g.yTicks[0].value).toBeLessThanOrEqual(-0.3);
    expect(g.yTicks[g.yTicks.length - 1].value).toBeGreaterThanOrEqual(0.4);
    expect(g.yTicks.some((tick) => tick.label === "0")).toBe(true);
  });

  it("reserves enough left margin for its widest y tick label and axis title", () => {
    const wide = parseExplanation({
      contract_version: 1,
      values: [[-1234.5], [987.6]],
      base_values: 0,
      data: [[0], [1]],
      feature_names: ["wide"],
    });
    const g = geometry({ parsed: wide, colorFeature: "none" });
    const widest = Math.max(...g.yTicks.map((tick) => tick.label.length * 6.5));
    expect(g.plotLeft).toBeGreaterThanOrEqual(g.yTitleX + 13 + 8 + widest + 8);
  });

  it("keeps tiny nonzero y ticks distinct instead of rounding them to zero", () => {
    const tiny = parseExplanation({
      contract_version: 1,
      values: [[-3e-8], [4e-8]],
      base_values: 0,
      data: [[0], [1]],
      feature_names: ["tiny"],
    });
    const labels = geometry({ parsed: tiny, colorFeature: "none" }).yTicks.map((tick) => tick.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.some((label) => label !== "0")).toBe(true);
  });

  it("centres an all-zero SHAP column on a useful y scale", () => {
    const zero = parseExplanation({
      contract_version: 1,
      values: [[0], [0]],
      base_values: 0,
      data: [[0], [1]],
      feature_names: ["zero"],
    });
    const g = geometry({ parsed: zero, colorFeature: "none" });
    expect(g.yTicks.length).toBeGreaterThan(1);
    expect(g.yTicks[0].value).toBeLessThan(0);
    expect(g.yTicks[g.yTicks.length - 1].value).toBeGreaterThan(0);
    expect(g.zeroRuleY).toBeCloseTo((g.plotTop + g.plotBottom) / 2, 12);
  });

  it("renders only the left and bottom scatter spines", () => {
    const svg = renderToStaticMarkup(createElement(ShapScatter, {
      explanation: {
        contract_version: 1 as const,
        values: [[-0.2], [0.3]],
        base_values: 0,
        data: [[0], [1]],
        feature_names: ["feature"],
      },
      feature: 0,
      colorFeature: "none",
    }));
    expect(svg).toContain('data-axis-spine="left"');
    expect(svg).toContain('data-axis-spine="bottom"');
    expect(svg).not.toContain('data-axis-spine="right"');
    expect(svg).not.toContain('data-axis-spine="top"');
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

    // The bar names the Feature it encodes: the colour is a second taxon's
    // value, and a bar labelled only "Feature value" reads as the plotted one's.
    expect(withBar).toContain("Colour feature");
    // The scale names what it encodes and says it is a colour scale, because
    // a rotated title down the right edge otherwise reads as a second y axis.
    expect(withBar).toContain('aria-label="Colour: Colour feature · Feature value: Low to High"');
    expect(withoutBar).not.toContain("Low to High");
  });

  it("drops the trend line when asked", () => {
    expect(geometry({ trend: false }).trendPath).toBeNull();
  });
});

describe("the x axis says what it measures", () => {
  it("carries the Feature's name and the quantity beside it", () => {
    const g = geometry();
    expect(g.xTitle.text).toBe("Fusobacterium nucleatum");
    expect(g.xTitle.unit).toBe(shapLabels.featureValue);
  });

  it("takes the quantity's wording from the labels, so it can be translated", () => {
    const g = scatterGeometry({
      parsed, featureIndex: 0, width: 600, height: 360,
      colorFeature: "none", colorFeatureMinScore: 0.2, xScale: "log", trend: false,
      labels: resolveLabels({ featureValue: "Relative abundance" }),
    });
    expect(g.xTitle.unit).toBe("Relative abundance");
  });
});
