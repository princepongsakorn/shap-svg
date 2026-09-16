import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beeswarmLayout, beeswarmRows } from "../src/core/beeswarmLayout";
import { heatmapLayout, heatmapRows } from "../src/core/heatmapLayout";
import { scalarFormatterLabels } from "../src/core/colorBar";
import { parseExplanation } from "../src/core/parse";
import { ShapBeeswarm } from "../src/react/ShapBeeswarm";
import { ShapHeatmap } from "../src/react/ShapHeatmap";
import { embeddingLayout } from "../src/core/embeddingLayout";
import { scatterGeometry } from "../src/react/ShapScatter";
import { shapLabels } from "../src/core/labels";

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
    [1, 0, 3],
    [0, 2, 1],
    [2, 1, 0],
    [0, 3, 2],
  ],
  feature_names: ["Bacteroides_dorei", "Parvimonas_micra", "Gemella_morbillorum"],
};
const explanation = parseExplanation(raw);

describe("beeswarm colour bar", () => {
  const opts = { width: 720, rowHeight: 28, marginLeft: 260, marginRight: 90, marginTop: 8, dotRadius: 3 };
  const layout = beeswarmLayout(beeswarmRows(explanation, 3, false, 0), { ...opts, colorBar: true });
  const bar = layout.colorBar!;

  it("spans the rows and sits 0.05/0.80 of the plot width right of it, as fig.colorbar does", () => {
    // shap 0.49.1 at 100 dpi: axes 100-596 px, bar 627-634.2 px, both 90-667.5 px tall.
    expect(31 / 496).toBeCloseTo(0.05 / 0.8, 3);
    expect(7.2 / 577.5).toBeCloseTo(1 / 80, 3);
    expect(bar.x).toBeCloseTo(260 + layout.plotWidth + layout.plotWidth * 0.0625, 9);
    expect(bar.y1).toBe(8);
    expect(bar.y2).toBe(layout.plotBottom);
    expect(bar.width).toBeCloseTo((layout.plotBottom - 8) / 80, 9);
  });

  it("labels the ends Low and High and the bar Feature value", () => {
    expect(bar.ticks.map((tick) => tick.label)).toEqual(["Low", "High"]);
    expect(bar.label.text).toBe("Feature value");
  });

  it("keeps the plot width when the right margin already holds the bar", () => {
    expect(layout.plotWidth).toBe(720 - 260 - 90);
    expect(bar.right).toBeLessThanOrEqual(720);
  });

  it("narrows the plot rather than clip the bar in a tight margin", () => {
    const tight = beeswarmLayout(beeswarmRows(explanation, 3, false, 0), {
      ...opts,
      marginRight: 20,
      colorBar: true,
    });
    expect(tight.plotWidth).toBeLessThan(720 - 260 - 20);
    expect(tight.colorBar!.right).toBeCloseTo(720, 6);
  });
});

describe("heatmap colour bar", () => {
  const opts = { width: 720, rowHeight: 26, marginLeft: 260, marginRight: 100, marginTop: 72 };
  const rows = heatmapRows(explanation, 3, false);
  const layout = heatmapLayout(rows, { ...opts, colorBar: true });
  const bar = layout.colorBar!;

  it("labels its ends with the symmetric colour range, formatted as matplotlib does", () => {
    expect(bar.ticks.map((tick) => tick.label)).toEqual(
      scalarFormatterLabels([rows.vmin, rows.vmax]).labels,
    );
    expect(bar.label.text).toBe("SHAP value (impact on model output)");
  });

  it("spans the f(x) chart and the grid, and clears the longest side bar", () => {
    expect(bar.y1).toBe(8);
    expect(bar.y2).toBe(layout.plotBottom);
    const longest = Math.max(...layout.rows.map((row) => row.sideBar.x + row.sideBar.width));
    expect(bar.x).toBeGreaterThan(longest);
    expect(bar.right).toBeLessThanOrEqual(720 + 1e-9);
  });

  it("is absent unless asked for", () => {
    expect(heatmapLayout(rows, opts).colorBar).toBeNull();
  });
});

describe("components", () => {
  it("draw both colour bars by default and neither when turned off", () => {
    const beeswarm = renderToStaticMarkup(createElement(ShapBeeswarm, { explanation: raw }));
    const heatmap = renderToStaticMarkup(createElement(ShapHeatmap, { explanation: raw }));
    expect(beeswarm).toContain("Feature value");
    expect(beeswarm).toContain(">High<");
    expect(heatmap).toContain("SHAP value (impact on model output)");

    const plain = renderToStaticMarkup(createElement(ShapBeeswarm, { explanation: raw, colorBar: false }));
    expect(plain).not.toContain(">High<");
  });
});

describe("the colour scales added in 0.3.0", () => {
  it("gives the embedding a colour bar that says what the colour measures", () => {
    const layout = embeddingLayout({
      parsed: explanation, width: 600, height: 400, colorBy: "sum",
    });
    expect(layout.colorBar).not.toBeNull();
    // The word "Colour" is the point: a rotated title down the right edge is
    // where a second y axis would be, and a reader took it for one.
    expect(layout.colorBar?.label.text).toBe(shapLabels.colorScale(shapLabels.sampleTotal));
  });

  it("names the Feature when the embedding colours by one", () => {
    const layout = embeddingLayout({
      parsed: explanation, width: 600, height: 400, colorBy: 1,
    });
    expect(layout.colorBar?.label.text).toContain("Parvimonas micra");
  });

  it("draws no embedding colour bar when nothing is encoded by colour", () => {
    const layout = embeddingLayout({
      parsed: explanation, width: 600, height: 400, colorBy: "none",
    });
    expect(layout.colorBar).toBeNull();
  });

  it("leaves the embedding room for the bar rather than drawing over it", () => {
    const withBar = embeddingLayout({
      parsed: explanation, width: 600, height: 400, colorBy: "sum",
    });
    const without = embeddingLayout({
      parsed: explanation, width: 600, height: 400, colorBy: "none",
    });
    expect(withBar.plotRight).toBeLessThan(without.plotRight);
    expect(withBar.colorBar!.x).toBeGreaterThanOrEqual(withBar.plotRight);
  });

  it("names the coloured Feature on the scatter's bar, not just 'Feature value'", () => {
    const geometry = scatterGeometry({
      parsed: explanation,
      featureIndex: 0,
      width: 600,
      height: 400,
      colorFeature: 1,
      colorFeatureMinScore: 0,
      xScale: "log",
      trend: false,
    });
    expect(geometry.colorBar?.label.text).toContain("Parvimonas micra");
    expect(geometry.colorBar?.label.text).toContain(shapLabels.featureValue);
    expect(geometry.colorBar?.label.text.startsWith("Colour:")).toBe(true);
  });
});
