import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { placeTooltip } from "../src/core/tooltip";
import { ShapBeeswarm } from "../src/react/ShapBeeswarm";
import { ShapHeatmap } from "../src/react/ShapHeatmap";
import { ShapWaterfall } from "../src/react/ShapWaterfall";

const box = {
  lines: ["Bacteroides dorei", "SHAP value: +0.012", "Feature value: 0.0042"],
  lineHeight: 15,
  minWidth: 160,
  chartWidth: 720,
  chartHeight: 400,
};

describe("placeTooltip", () => {
  it("sits right of the point, its first line level with it, when it fits", () => {
    expect(placeTooltip({ ...box, anchorX: 300, anchorY: 200 })).toEqual({
      x: 308, y: 176, width: 160, height: 54,
    });
  });

  it("flips to the left of the point rather than run past the chart's right edge", () => {
    const placed = placeTooltip({ ...box, anchorX: 700, anchorY: 200 });
    expect(placed.x + placed.width).toBe(692);
  });

  it("stays inside the chart at the top and at the bottom", () => {
    expect(placeTooltip({ ...box, anchorX: 300, anchorY: 5 }).y).toBe(0);
    const low = placeTooltip({ ...box, anchorX: 300, anchorY: 399 });
    expect(low.y + low.height).toBe(400);
  });

  it("widens to hold its longest line", () => {
    const long = placeTooltip({
      ...box, anchorX: 100, anchorY: 100, lines: ["Phascolarctobacterium succinatutens"],
    });
    expect(long.width).toBeCloseTo(35 * 6.5 + 14, 9);
    expect(placeTooltip({ ...box, anchorX: 100, anchorY: 100, lines: ["a"] }).width).toBe(160);
  });
});

describe("accessible names use the chart's own words", () => {
  const raw = {
    contract_version: 1,
    values: [[0.3, -0.1], [-0.2, 0.15]],
    base_values: 0.4,
    data: [[0.004, 0.001], [0.002, 0.02]],
    feature_names: ["Bacteroides_dorei", "Parvimonas_micra"],
  };
  const labelled = { ...raw, sample_labels: ["S-17", "S-18"], sample_label_column: "sample_id" };
  const words = { shapValue: "Contribution", sampleFallback: (n: number) => `Specimen ${n}` };

  it("beeswarm and heatmap", () => {
    expect(renderToStaticMarkup(createElement(ShapBeeswarm, { explanation: raw }))).toContain(
      'aria-label="SHAP value of each feature, for every sample"',
    );
    expect(renderToStaticMarkup(createElement(ShapHeatmap, { explanation: raw, labels: words }))).toContain(
      'aria-label="Contribution by feature and sample"',
    );
  });

  it("waterfall names the sample as the heatmap does, counting from 1", () => {
    expect(renderToStaticMarkup(createElement(ShapWaterfall, { explanation: raw, sampleIndex: 1 }))).toContain(
      'aria-label="SHAP value of each feature for Sample 2"',
    );
    expect(
      renderToStaticMarkup(createElement(ShapWaterfall, { explanation: raw, labels: words })),
    ).toContain('aria-label="Contribution of each feature for Specimen 1"');
    expect(
      renderToStaticMarkup(createElement(ShapWaterfall, { explanation: labelled, sampleIndex: 1 })),
    ).toContain('aria-label="SHAP value of each feature for sample_id: S-18"');
  });
});
