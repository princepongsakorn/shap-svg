import { ParsedExplanation } from "./types";
import { collapseToDisplay } from "./collapse";
import { NEGATIVE_COLOR, POSITIVE_COLOR } from "./barLayout";
import { PlotLabels, resolveLabels } from "./labels";

/**
 * One Sample's contributions as a single horizontal bar.
 *
 * Positive SHAP values push in from the left and negative from the right; they
 * meet at f(x). The waterfall says the same thing but needs vertical space
 * proportional to `maxDisplay`, which makes it unusable inside a row of a
 * Sample list. This fits on one line.
 *
 * `shap.plots.force` hands its renderer every Feature and lets the JavaScript
 * bundle deal with crowding. At p = 865 that is not an option, so this takes
 * `maxDisplay` and collapses the tail exactly as the waterfall does — an
 * addition, not a deviation: SHAP has no behaviour here to match.
 */

/** SHAP's `contribution_threshold`: a segment under this share of total effect goes unlabelled. */
const MIN_LABEL_SHARE = 0.05;
const MARGIN = { left: 16, right: 16 };

export type ForceSegment = {
  label: string;
  featureIndex: number | null;
  isOtherRow: boolean;
  value: number;
  x: number;
  width: number;
  color: string;
  labelled: boolean;
};

export type ForceLayoutInput = {
  parsed: ParsedExplanation;
  sampleIndex: number;
  width: number;
  height: number;
  maxDisplay: number;
  faithfulOtherRow?: boolean;
  labels?: PlotLabels;
};

export type ForceLayout = {
  segments: ForceSegment[];
  baseValue: number;
  modelOutput: number;
  /** Where f(x) sits across the bar. */
  meetingX: number;
  baseValueX: number;
  barY: number;
  barHeight: number;
};

export function forceLayout(input: ForceLayoutInput): ForceLayout {
  const { parsed, sampleIndex, width, height, maxDisplay, faithfulOtherRow = false } = input;
  const words = input.labels ?? resolveLabels();

  const row = parsed.values[sampleIndex];
  const baseValue = parsed.baseValues[sampleIndex];
  const modelOutput = row.reduce((sum, v) => sum + v, 0) + baseValue;

  const magnitudes = row.map((v) => Math.abs(v));
  const order = magnitudes
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map((entry) => entry.index);
  const display = collapseToDisplay(
    parsed.featureNames, row, order, maxDisplay, faithfulOtherRow, words,
  );

  const totalEffect = display.rows.reduce((sum, r) => sum + Math.abs(r.value), 0) || 1;
  const usable = Math.max(0, width - MARGIN.left - MARGIN.right);
  const scale = usable / totalEffect;

  const positives = display.rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const negatives = display.rows.filter((r) => r.value <= 0).sort((a, b) => a.value - b.value);

  const positiveTotal = positives.reduce((sum, r) => sum + Math.abs(r.value), 0);
  const meetingX = MARGIN.left + positiveTotal * scale;
  const barHeight = Math.max(12, height - 48);
  const barY = 24;

  const segments: ForceSegment[] = [];
  // Positives fill leftwards from the meeting point, largest adjacent to it.
  let cursor = meetingX;
  for (const r of positives) {
    const segmentWidth = Math.abs(r.value) * scale;
    cursor -= segmentWidth;
    segments.push({
      label: r.label,
      featureIndex: r.featureIndex,
      isOtherRow: r.isOtherRow,
      value: r.value,
      x: cursor,
      width: segmentWidth,
      color: POSITIVE_COLOR,
      labelled: Math.abs(r.value) / totalEffect >= MIN_LABEL_SHARE,
    });
  }
  // Negatives fill rightwards, again largest adjacent to the meeting point.
  cursor = meetingX;
  for (const r of negatives) {
    const segmentWidth = Math.abs(r.value) * scale;
    segments.push({
      label: r.label,
      featureIndex: r.featureIndex,
      isOtherRow: r.isOtherRow,
      value: r.value,
      x: cursor,
      width: segmentWidth,
      color: NEGATIVE_COLOR,
      labelled: Math.abs(r.value) / totalEffect >= MIN_LABEL_SHARE,
    });
    cursor += segmentWidth;
  }

  const outputSpan = modelOutput - baseValue;
  return {
    segments,
    baseValue,
    modelOutput,
    meetingX,
    baseValueX: meetingX - outputSpan * scale,
    barY,
    barHeight,
  };
}
