import { describe, expect, it } from "vitest";
import { parseExplanation } from "../src/core/parse";
import { forceLayout } from "../src/core/forceLayout";
import { forceTooltipLines } from "../src/react/ShapForce";
import { shapLabels } from "../src/core/labels";
import { runsToText } from "../src/core/tooltip";
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

describe("what a hovered segment says", () => {
  const withNames = parseExplanation({
    contract_version: 1,
    values: [[0.30, -0.10, 0.01]],
    base_values: 0.4,
    data: [[0.002, 0, 0.5]],
    feature_names: ["Fusobacterium_nucleatum", "Parvimonas_micra", "c"],
  });
  const layout = forceLayout({
    parsed: withNames, sampleIndex: 0, width: 640, height: 110, maxDisplay: 3,
  });
  const lines = (label: string) =>
    forceTooltipLines(
      withNames, 0, layout.segments.find((s) => s.label.startsWith(label))!, shapLabels,
    ).map(runsToText);

  const runs = (label: string) =>
    forceTooltipLines(
      withNames, 0, layout.segments.find((s) => s.label.startsWith(label))!, shapLabels,
    );

  it("names the taxon rather than leaving a bare number", () => {
    expect(lines("Fusobacterium")[0]).toBe("Fusobacterium nucleatum");
  });

  it("signs the contribution, so its direction is unambiguous", () => {
    expect(lines("Fusobacterium")[1]).toBe("SHAP value: +0.3");
    expect(lines("Parvimonas")[1]).toBe("SHAP value: −0.1");
  });

  it("carries the abundance the contribution came from", () => {
    expect(lines("Fusobacterium")[2]).toContain("0.002");
  });

  it("says the taxon was not detected rather than showing a zero", () => {
    expect(lines("Parvimonas")[2]).toBe(`${shapLabels.featureValue}: ${shapLabels.absent}`);
  });
});

describe("scientific names in the hover box", () => {
  const withNames = parseExplanation({
    contract_version: 1,
    values: [[0.30, -0.10, 0.01]],
    base_values: 0.4,
    data: [[0.002, 0, 0.5]],
    feature_names: ["Fusobacterium_nucleatum", "Parvimonas_micra", "c"],
  });
  const layout = forceLayout({
    parsed: withNames, sampleIndex: 0, width: 640, height: 110, maxDisplay: 2,
  });

  it("sets a taxon's name in italics and leaves its number upright", () => {
    const segment = layout.segments.find((s) => s.label.startsWith("Fusobacterium"))!;
    const [nameLine] = forceTooltipLines(withNames, 0, segment, shapLabels);
    expect(nameLine).toEqual([{ text: "Fusobacterium nucleatum", italic: true }]);
  });

  it("leaves the Other features row upright, because it is not a taxon", () => {
    const other = layout.segments.find((s) => s.isOtherRow)!;
    const [nameLine] = forceTooltipLines(withNames, 0, other, shapLabels);
    expect(nameLine.every((run) => !run.italic)).toBe(true);
  });
});
