import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { forceLayout } from "../src/core/forceLayout";
import { NEGATIVE_COLOR, POSITIVE_COLOR } from "../src/core/barLayout";

const parsed = parseExplanation({
  contract_version: 1,
  values: [[0.30, -0.10, 0.01, -0.005]],
  base_values: 0.4,
  data: [[1, 2, 3, 4]],
  feature_names: ["a", "b", "c", "d"],
});

const layout = (overrides = {}) =>
  forceLayout({ parsed, sampleIndex: 0, width: 640, height: 90, maxDisplay: 4, ...overrides });

describe("forceLayout", () => {
  it("meets at the Model output", () => {
    expect(layout().modelOutput).toBeCloseTo(0.605, 12);
  });

  it("keeps the Base value as its own mark", () => {
    expect(layout().baseValue).toBeCloseTo(0.4, 12);
  });

  it("gives positive and negative segments opposite colours", () => {
    const l = layout();
    expect(l.segments.find((s) => s.value > 0)?.color).toBe(POSITIVE_COLOR);
    expect(l.segments.find((s) => s.value < 0)?.color).toBe(NEGATIVE_COLOR);
  });

  it("puts the largest contribution against the meeting point", () => {
    const positives = layout().segments.filter((s) => s.value > 0);
    expect(positives[0].value).toBeGreaterThanOrEqual(positives[positives.length - 1].value);
  });

  it("labels only segments worth at least 5% of the total effect", () => {
    const labelled = layout().segments.filter((s) => s.labelled).map((s) => s.label);
    expect(labelled).toContain("a");
    expect(labelled).not.toContain("d");
  });

  it("collapses the tail into the Other features row", () => {
    const l = layout({ maxDisplay: 2 });
    expect(l.segments.some((s) => s.isOtherRow)).toBe(true);
  });

  it("gives every segment a positive width", () => {
    for (const segment of layout().segments) expect(segment.width).toBeGreaterThanOrEqual(0);
  });

  it("does not give segments negative widths when the chart is narrower than its margins", () => {
    for (const segment of layout({ width: 20 }).segments) {
      expect(segment.width).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps both annotation rows inside a 110px chart", () => {
    const compact = layout({ height: 110 });

    expect(compact.barY - 10).toBeGreaterThanOrEqual(12);
    expect(compact.barY + compact.barHeight + 22).toBeLessThanOrEqual(110);
  });

  it("keeps equal Base value and Model output marks together for an all-zero Sample", () => {
    const zeroParsed = parseExplanation({
      contract_version: 1,
      values: [[0, 0]],
      base_values: 0.4,
      data: [[1, 2]],
      feature_names: ["a", "b"],
    });
    const zero = forceLayout({
      parsed: zeroParsed, sampleIndex: 0, width: 640, height: 90, maxDisplay: 2,
    });

    expect(zero.baseValueX).toBe(zero.meetingX);
    for (const segment of zero.segments) expect(Number.isFinite(segment.width)).toBe(true);
  });
});
