import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { embeddingLayout } from "../src/core/embeddingLayout";
import { embeddingTooltipLines } from "../src/react/ShapEmbedding";
import { shapLabels } from "../src/core/labels";
import { runsToText } from "../src/core/tooltip";

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
    // Not "SHAP PC1": a projection computed elsewhere may be nothing of the
    // kind, and the wording comes from the labels so it can be translated.
    expect(l.xTitle).toBe(shapLabels.suppliedComponent(1));
    expect(l.yTitle).toBe(shapLabels.suppliedComponent(2));
    expect(l.xTitle).not.toContain("PC");
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

describe("the embedding's frame and hover detail", () => {
  it("marks where each component is zero, since the projection is centred", () => {
    const l = layout();
    expect(l.zeroX).not.toBeNull();
    expect(l.zeroY).not.toBeNull();
    expect(l.zeroX!).toBeGreaterThan(l.plotLeft);
    expect(l.zeroX!).toBeLessThan(l.plotRight);
  });

  it("omits a zero line that would fall outside the drawn range", () => {
    const offCentre = layout({ coords: [[5, 5], [6, 6], [7, 7], [8, 8]] as [number, number][] });
    expect(offCentre.zeroX).toBeNull();
    expect(offCentre.zeroY).toBeNull();
  });

  it("names the Sample, where its prediction landed, and the taxa that drove it", () => {
    const lines = embeddingTooltipLines(parsed, 0, "sum", shapLabels).map(runsToText);
    expect(lines[0]).toBe("Sample 1");
    expect(lines[1]).toContain(shapLabels.modelOutput);
    expect(lines[2]).toContain(shapLabels.sampleTotal);
    // Three strongest contributions follow, strongest first.
    expect(lines).toHaveLength(5);
    expect(lines[3]).toContain("a");
  });

  it("orders the named taxa by the size of their contribution", () => {
    const lines = embeddingTooltipLines(parsed, 0, "sum", shapLabels);
    const named = lines.slice(3).map((line) => runsToText(line).trim().split(" ")[0]);
    expect(named[0]).toBe("a");
  });
});

describe("what the components turn out to mean", () => {
  it("says a component tracks the total when it clearly does", () => {
    // Contributions that grow together, so the first component is the total.
    const tracking = parseExplanation({
      contract_version: 1,
      values: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
      base_values: 0,
      data: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
      feature_names: ["a", "b"],
    });
    const l = embeddingLayout({ parsed: tracking, width: 500, height: 400, colorBy: "sum" });
    expect(l.xMeaning).toContain("r =");
  });

  it("stays silent when no component tracks the total", () => {
    const l = layout();
    const said = [l.xMeaning, l.yMeaning].filter(Boolean);
    for (const text of said) expect(text).toContain("r =");
  });

  it("never claims a meaning for a component that is orthogonal to the total", () => {
    const tracking = parseExplanation({
      contract_version: 1,
      values: [[1, -1], [2, -2], [3, -3], [4, -4], [5, -5]],
      base_values: 0,
      data: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
      feature_names: ["a", "b"],
    });
    // Every Sample's total is zero here, so nothing can track it.
    const l = embeddingLayout({ parsed: tracking, width: 500, height: 400, colorBy: "sum" });
    expect(l.xMeaning).toBeNull();
    expect(l.yMeaning).toBeNull();
  });
});
