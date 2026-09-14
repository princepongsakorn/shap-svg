import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlotLabels, resolveLabels, shapLabels } from "../src/core/labels";
import { collapseToDisplay } from "../src/core/collapse";
import { parseExplanation } from "../src/core/parse";
import { barLayout } from "../src/core/barLayout";
import { beeswarmLayout, beeswarmRows } from "../src/core/beeswarmLayout";
import { heatmapLayout, heatmapRows } from "../src/core/heatmapLayout";
import { waterfallLayout, waterfallRows } from "../src/core/waterfallLayout";
import { ShapBar } from "../src/react/ShapBar";
import { ShapBeeswarm } from "../src/react/ShapBeeswarm";
import { ShapHeatmap } from "../src/react/ShapHeatmap";
import { ShapWaterfall } from "../src/react/ShapWaterfall";

const raw = {
  contract_version: 1,
  values: [
    [0.3, -0.1, 0.05],
    [-0.2, 0.15, -0.02],
    [0.1, 0.02, 0.01],
    [-0.05, -0.12, 0.04],
  ],
  base_values: 0.4,
  data: [
    [0.0042, 0.001, 0.03],
    [0.0021, 0.02, 0.01],
    [0.0063, 0.004, 0.002],
    [0.0011, 0.03, 0.02],
  ],
  feature_names: ["Bacteroides_dorei", "Parvimonas_micra", "Gemella_morbillorum"],
};
const explanation = parseExplanation(raw);

const research: Partial<PlotLabels> = {
  shapValue: "Contribution",
  shapValueAxis: "Contribution to predicted probability",
  meanAbsShapValue: "Mean absolute contribution",
  featureValue: "Relative abundance",
  featureValueLow: "Rare",
  featureValueHigh: "Abundant",
  samples: "Samples",
  sampleTotal: "Total contribution",
  sampleFallback: (n) => `Specimen ${n}`,
  baseValue: "Average prediction",
  modelOutput: "Prediction",
  otherFeatures: (n) => `${n} other taxa`,
};
const labels = resolveLabels(research);

describe("resolveLabels", () => {
  it("is SHAP's own wording when nothing is given", () => {
    expect(resolveLabels()).toBe(shapLabels);
    expect(shapLabels.shapValueAxis).toBe("SHAP value (impact on model output)");
    expect(shapLabels.otherFeatures(3, "sum")).toBe("Sum of 3 other features");
    expect(shapLabels.otherFeatures(3, "count")).toBe("3 other features");
  });

  it("keeps SHAP's wording for keys not given, or given as undefined", () => {
    const partial = resolveLabels({ featureValue: "Relative abundance", samples: undefined });
    expect(partial.featureValue).toBe("Relative abundance");
    expect(partial.samples).toBe("Instances");
    expect(partial.shapValue).toBe("SHAP value");
  });
});

describe("layouts draw the given wording", () => {
  it("bar: x axis and the other-features row", () => {
    const rows = collapseToDisplay(explanation.featureNames, [3, 2, 1], [0, 1, 2], 2, false, labels);
    const layout = barLayout(rows, {
      width: 720, rowHeight: 26, marginLeft: 260, marginRight: 90, marginTop: 8, labels,
    });
    expect(rows.rows.at(-1)?.label).toBe("1 other taxa");
    expect(layout.xTitle.text).toBe("Mean absolute contribution");
  });

  it("beeswarm: x axis, colour bar and the other-features row", () => {
    const rows = beeswarmRows(explanation, 2, false, 0, "importance", labels);
    const layout = beeswarmLayout(rows, {
      width: 720, rowHeight: 28, marginLeft: 260, marginRight: 90, marginTop: 8, dotRadius: 3,
      colorBar: true, labels,
    });
    expect(rows.rows.some((row) => row.label === "1 other taxa")).toBe(true);
    expect(layout.xTitle.text).toBe("Contribution to predicted probability");
    expect(layout.colorBar?.label.text).toBe("Relative abundance");
    expect(layout.colorBar?.ticks.map((tick) => tick.label)).toEqual(["Rare", "Abundant"]);
  });

  it("heatmap: Sample axis, colour bar and the other-features row", () => {
    const rows = heatmapRows(explanation, 2, true, "importance", labels);
    const layout = heatmapLayout(rows, {
      width: 720, rowHeight: 26, marginLeft: 260, marginRight: 100, marginTop: 72,
      colorBar: true, labels,
    });
    expect(rows.rows.at(-1)?.label).toBe("2 other taxa");
    expect(layout.xTitle.text).toBe("Samples");
    expect(layout.colorBar?.label.text).toBe("Contribution to predicted probability");
  });

  it("waterfall: both reference values and the other-features row", () => {
    const rows = waterfallRows(explanation, 0, 2, false, labels);
    const layout = waterfallLayout(rows, {
      width: 720, rowHeight: 30, marginLeft: 260, marginRight: 110, marginTop: 34, labels,
    });
    expect(rows.rows.some((row) => row.label === "1 other taxa")).toBe(true);
    expect(layout.axisMarks.map((mark) => mark.label.split(" = ")[0])).toEqual([
      "Average prediction",
      "Prediction",
    ]);
  });
});

describe("components", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (component: ComponentType<any>, props: object) =>
    renderToStaticMarkup(createElement(component, { explanation: raw, ...props }));

  it("beeswarm tooltip uses the wording, and a feature value carries no sign", () => {
    const svg = render(ShapBeeswarm, { labels: research });
    expect(svg).toContain("Contribution: ");
    expect(svg).toMatch(/Relative abundance: \d/);

    const plain = render(ShapBeeswarm, {});
    expect(plain).toMatch(/Feature value: \d/);
    expect(plain).not.toContain("Feature value: +");
  });

  it("heatmap names an unlabelled Sample with the fallback", () => {
    expect(render(ShapHeatmap, { labels: research })).toContain("Specimen 1, total Contribution");
    expect(render(ShapHeatmap, {})).toContain("Sample 1, total SHAP value");
  });

  it("bar and waterfall draw the wording", () => {
    expect(render(ShapBar, { labels: research })).toContain("Mean absolute contribution");
    expect(render(ShapWaterfall, { labels: research })).toContain("Average prediction = ");
    expect(render(ShapWaterfall, {})).toContain("E[f(X)] = ");
  });
});
