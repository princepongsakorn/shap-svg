import { describe, expect, it } from "vitest";
import {
  colorBarExtent,
  colorBarLayout,
  ColorBarSpec,
  fitColorBar,
  scalarFormatterLabels,
} from "../src/core/colorBar";
import { sampleColormap } from "../src/core/colormap";

describe("scalarFormatterLabels", () => {
  // Captured from matplotlib: plt.colorbar(m, ticks=[-v, v]) and the labels it drew.
  it.each([
    [0.21419478, ["−0.2142", "0.2142"], undefined],
    [1.0, ["−1", "1"], undefined],
    [0.05, ["−0.05", "0.05"], undefined],
    [0.003172, ["−0.003172", "0.003172"], undefined],
    [12.5, ["−12.5", "12.5"], undefined],
    [0.1, ["−0.1", "0.1"], undefined],
    [0.00004567, ["−4.567", "4.567"], "1e−5"],
    [2.345678, ["−2.346", "2.346"], undefined],
    [0.999, ["−0.999", "0.999"], undefined],
  ])("labels ±%s as matplotlib does", (value, labels, offsetText) => {
    expect(scalarFormatterLabels([-value, value])).toEqual(
      offsetText ? { labels, offsetText } : { labels },
    );
  });

  it("writes an all-zero range without a minus sign", () => {
    expect(scalarFormatterLabels([0, 0]).labels).toEqual(["0", "0"]);
  });
});

const beeswarmSpec: ColorBarSpec = {
  colormap: "red_blue",
  tickLabels: ["Low", "High"],
  label: "Feature value",
  labelPad: 0,
};

describe("colorBarLayout", () => {
  const bar = colorBarLayout(beeswarmSpec, { x: 500, y1: 8, y2: 408 });

  it("is as tall as the plot and one eightieth as wide (aspect=80)", () => {
    expect(bar.width).toBe(5);
    expect(bar.steps[0].y + bar.steps[0].height).toBe(408);
    expect(bar.steps[bar.steps.length - 1].y).toBeCloseTo(8, 9);
  });

  it("runs the colour map from bottom to top", () => {
    expect(bar.steps[0].color).toBe(sampleColormap("red_blue", 0));
    expect(bar.steps[bar.steps.length - 1].color).toBe(sampleColormap("red_blue", 1));
  });

  it("puts the first tick label at the bottom and the second at the top", () => {
    expect(bar.ticks).toEqual([
      { y: 408, label: "Low" },
      { y: 8, label: "High" },
    ]);
    expect(bar.tickX).toBe(500 + 5 + 3.5);
  });

  it("centres the rotated label beside the widest tick label", () => {
    expect(bar.label.y).toBe(208);
    expect(bar.label.x).toBeGreaterThan(bar.tickX + 4 * 11 * 0.6);
    expect(bar.right).toBeCloseTo(500 + colorBarExtent(400, beeswarmSpec), 9);
  });

  it("pulls the label back over the tick labels by a negative labelpad", () => {
    const pulled = colorBarLayout({ ...beeswarmSpec, labelPad: -10 }, { x: 500, y1: 8, y2: 408 });
    expect(pulled.label.x).toBeCloseTo(bar.label.x - 10, 9);
  });
});

describe("fitColorBar", () => {
  it("leaves the plot alone when the margin already holds the bar", () => {
    expect(
      fitColorBar({ plotWidth: 400, available: 100, gapRatio: 0.0625, minGap: 0, extent: 50 }),
    ).toEqual({ plotWidth: 400, gap: 25 });
  });

  it("narrows the plot by exactly what the bar lacks, on the proportional gap", () => {
    const fit = fitColorBar({ plotWidth: 400, available: 60, gapRatio: 0.0625, minGap: 0, extent: 50 });
    expect(fit.gap).toBeCloseTo(fit.plotWidth * 0.0625, 9);
    expect(fit.plotWidth + fit.gap + 50).toBeCloseTo(400 + 60, 9);
  });

  it("narrows the plot by exactly what the bar lacks, on the minimum gap", () => {
    const fit = fitColorBar({ plotWidth: 360, available: 100, gapRatio: 0.1124, minGap: 66, extent: 58 });
    expect(fit.gap).toBe(66);
    expect(fit.plotWidth + fit.gap + 58).toBeCloseTo(360 + 100, 9);
  });
});
