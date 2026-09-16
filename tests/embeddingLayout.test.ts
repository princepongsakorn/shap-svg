import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { embeddingLayout } from "../src/core/embeddingLayout";

const parsed = parseExplanation({
  contract_version: 1,
  values: [[2, 1], [-2, -1], [1, 0.5], [-1, -0.5]],
  base_values: 0.3,
  data: [[1, 2], [3, 4], [5, 6], [7, 8]],
  feature_names: ["a", "b"],
});

const layout = (overrides = {}) =>
  embeddingLayout({ parsed, width: 500, height: 400, colorBy: "sum", ...overrides });

describe("embeddingLayout", () => {
  it("places one point per Sample", () => {
    expect(layout().points).toHaveLength(4);
  });

  it("keeps every point inside the plot area", () => {
    const l = layout();
    for (const p of l.points) {
      expect(p.cx).toBeGreaterThanOrEqual(l.plotLeft);
      expect(p.cx).toBeLessThanOrEqual(l.plotRight);
      expect(p.cy).toBeGreaterThanOrEqual(l.plotTop);
      expect(p.cy).toBeLessThanOrEqual(l.plotBottom);
    }
  });

  it("labels the axes with the variance each component explains", () => {
    expect(layout().xTitle).toMatch(/^SHAP PC1 \(\d+% of SHAP variance\)$/);
    expect(layout().yTitle).toMatch(/^SHAP PC2 \(\d+% of SHAP variance\)$/);
  });

  it("uses supplied coordinates instead of running PCA, and drops the ratios", () => {
    const l = layout({ coords: [[0, 0], [1, 1], [2, 2], [3, 3]] as [number, number][] });
    expect(l.xTitle).toBe("SHAP PC1");
    expect(l.yTitle).toBe("SHAP PC2");
    expect(l.points[0].cx).toBeLessThan(l.points[3].cx);
  });

  it("colours by the sum of SHAP values by default", () => {
    // Sample 0 has the largest Σφ and Sample 1 the smallest, so they take the
    // two ends of the ramp and differ.
    const l = layout();
    expect(l.points[0].color).not.toBe(l.points[1].color);
  });

  it("rejects coordinates that do not match the Sample count", () => {
    expect(() => layout({ coords: [[0, 0]] as [number, number][] })).toThrow(/4/);
  });
});
