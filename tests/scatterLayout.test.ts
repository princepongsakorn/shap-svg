import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import {
  binnedMedianTrend,
  logDomain,
  scatterPoints,
  wrapToWidth,
} from "../src/core/scatterLayout";

const parsed = parseExplanation({
  contract_version: 1,
  values: [[0.1, 0], [0.2, 0], [-0.3, 0], [0.4, 0]],
  base_values: 0.5,
  data: [[0, 1], [0.002, 1], [0, 1], [0.5, 1]],
  feature_names: ["Fusobacterium_nucleatum", "other"],
});

describe("scatterPoints", () => {
  it("separates Samples where the taxon was not detected", () => {
    const { absent, detected } = scatterPoints(parsed, 0);
    expect(absent.map((p) => p.sampleIndex)).toEqual([0, 2]);
    expect(detected.map((p) => p.sampleIndex)).toEqual([1, 3]);
  });

  it("carries each point's SHAP value alongside its abundance", () => {
    expect(scatterPoints(parsed, 0).detected[0]).toEqual({
      sampleIndex: 1,
      value: 0.002,
      shap: 0.2,
    });
  });

  it("sorts detected points by abundance so the trend can walk them", () => {
    const values = scatterPoints(parsed, 0).detected.map((p) => p.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it("returns an empty Absent band when every Sample has the taxon", () => {
    const dense = parseExplanation({
      contract_version: 1,
      values: [[1], [2]],
      base_values: 0,
      data: [[0.3], [0.4]],
      feature_names: ["a"],
    });
    expect(scatterPoints(dense, 0).absent).toEqual([]);
  });
});

describe("logDomain", () => {
  it("spans the smallest and largest detected abundance", () => {
    expect(logDomain(scatterPoints(parsed, 0).detected)).toEqual([0.002, 0.5]);
  });

  it("widens a domain where every Sample shares one abundance", () => {
    const [low, high] = logDomain([{ sampleIndex: 0, value: 0.1, shap: 0 }]);
    expect(low).toBeLessThan(0.1);
    expect(high).toBeGreaterThan(0.1);
  });
});

describe("binnedMedianTrend", () => {
  it("returns the median SHAP value of each window", () => {
    const detected = Array.from({ length: 20 }, (_, i) => ({
      sampleIndex: i,
      value: i + 1,
      shap: i < 10 ? 0 : 10,
    }));
    const trend = binnedMedianTrend(detected);
    expect(trend).toHaveLength(10);
    expect(trend[0].shap).toBe(0);
    expect(trend[trend.length - 1].shap).toBe(10);
  });

  it("anchors each window at its median abundance", () => {
    const detected = Array.from({ length: 40 }, (_, i) => ({
      sampleIndex: i,
      value: i + 1,
      shap: 0,
    }));
    // Forty detected Samples means windows of four, so the first window spans
    // abundances 1 to 4 and its median abundance is 2.5.
    expect(binnedMedianTrend(detected)[0].value).toBe(2.5);
  });

  it("draws nothing for three detected Samples and something for four", () => {
    const point = (i: number) => ({ sampleIndex: i, value: i + 1, shap: i });
    expect(binnedMedianTrend([0, 1, 2].map(point))).toEqual([]);
    expect(binnedMedianTrend([0, 1, 2, 3].map(point))).not.toEqual([]);
  });

  it("draws nothing for fewer than four detected Samples", () => {
    expect(binnedMedianTrend([{ sampleIndex: 0, value: 1, shap: 1 }])).toEqual([]);
  });
});

describe("the Absent band's tick", () => {
  it("wraps onto lines narrow enough to clear the first abundance tick", () => {
    const lines = wrapToWidth("Not detected (n = 146)", 70);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length * 5.6).toBeLessThanOrEqual(70);
  });

  it("leaves a label that already fits on one line", () => {
    expect(wrapToWidth("Absent (n = 2)", 200)).toEqual(["Absent (n = 2)"]);
  });

  it("never drops a word, whatever the wording", () => {
    const text = "Ikke påvist (n = 1234)";
    expect(wrapToWidth(text, 40).join(" ")).toBe(text);
  });
});
