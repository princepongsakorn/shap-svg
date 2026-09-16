import { ParsedExplanation } from "./types";
import { globalImportance, orderFeatures } from "./order";
import { ColormapName, sampleColormap } from "./colormap";

/**
 * Each Sample as a path from the Base value up to its Model output.
 *
 * Two things about `shap.plots.decision` are easy to get wrong and are fixed
 * here deliberately.
 *
 * It has no Other features row. Its `feature_display_range` simply omits the
 * Features it is not showing, and starts each path at the Base value *plus*
 * those Features' SHAP values — the remainder lives in the path's origin, and
 * an explicit row would draw it twice.
 *
 * Its x limits claim to be symmetric about the Base value and are not: the
 * branch taken when the paths reach further below the Base value than above it
 * returns the raw data range. Since the colour scale is clamped to those
 * limits, that slides the ramp's neutral point off the Base value. This is
 * always symmetric.
 */

const AXIS_HEIGHT = 52;
const MARGIN = { left: 220, right: 40, top: 16 };
/** matplotlib's autoscale margin, which SHAP inherits. */
const X_MARGIN = 0.02;
/** Stroke opacity at one path, and the Sample count at which it reaches its floor. */
const MAX_OPACITY = 0.9;
const MIN_OPACITY = 0.08;
const OPACITY_FLOOR_AT = 400;

export type DecisionPath = {
  sampleIndex: number;
  /** Cumulative Model output at each row boundary, bottom to top. */
  values: number[];
  points: { x: number; y: number }[];
  color: string;
};

export type DecisionLayoutInput = {
  parsed: ParsedExplanation;
  width: number;
  rowHeight: number;
  maxDisplay: number;
  sampleIndices?: number[];
  colormap?: ColormapName;
};

export type DecisionLayout = {
  /** Bottom row first — least important Feature at the bottom, as SHAP draws it. */
  rowLabels: string[];
  rowY: number[];
  paths: DecisionPath[];
  pathOpacity: number;
  xDomain: [number, number];
  /** The value the x axis is centred on. */
  baseValue: number;
  baseValueX: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  height: number;
};

export function decisionLayout(input: DecisionLayoutInput): DecisionLayout {
  const { parsed, width, rowHeight, maxDisplay, colormap = "red_blue" } = input;
  const indices = input.sampleIndices ?? parsed.values.map((_, i) => i);

  // SHAP sorts by ascending sum|phi| and draws the last rows; mean|phi| gives
  // the same order, and order.ts already computes it descending.
  const descending = orderFeatures(globalImportance(parsed));
  const shown = descending.slice(0, Math.min(maxDisplay, descending.length));
  const hidden = descending.slice(shown.length);
  // Bottom to top: least important of the shown Features first.
  const bottomUp = [...shown].reverse();

  const paths = indices.map((sampleIndex) => {
    const row = parsed.values[sampleIndex];
    const hiddenSum = hidden.reduce((sum, j) => sum + row[j], 0);
    const values = [parsed.baseValues[sampleIndex] + hiddenSum];
    for (const j of bottomUp) values.push(values[values.length - 1] + row[j]);
    return { sampleIndex, values };
  });

  const base = indices.length === 0
    ? 0
    : indices.reduce((sum, sampleIndex) => sum + parsed.baseValues[sampleIndex], 0) / indices.length;
  let reach = 0;
  for (const path of paths) {
    for (const value of path.values) reach = Math.max(reach, Math.abs(value - base));
  }
  reach = reach || 1;
  const pad = reach * 2 * X_MARGIN;
  const xDomain: [number, number] = [base - reach - pad, base + reach + pad];

  const plotLeft = MARGIN.left;
  const plotRight = width - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = plotTop + bottomUp.length * rowHeight;
  const toX = (v: number) =>
    plotLeft + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * (plotRight - plotLeft);
  // values[0] sits on the bottom edge; values[i] on the boundary above row i-1.
  const toY = (step: number) => plotBottom - step * rowHeight;

  const pathOpacity =
    MIN_OPACITY +
    (MAX_OPACITY - MIN_OPACITY) *
      Math.max(0, 1 - Math.max(0, indices.length - 1) / OPACITY_FLOOR_AT);

  return {
    rowLabels: bottomUp.map((j) => parsed.featureNames[j]),
    rowY: bottomUp.map((_, i) => plotBottom - i * rowHeight - rowHeight / 2),
    paths: paths.map(({ sampleIndex, values }) => {
      const end = values[values.length - 1];
      const t = (end - xDomain[0]) / (xDomain[1] - xDomain[0]);
      return {
        sampleIndex,
        values,
        points: values.map((value, step) => ({ x: toX(value), y: toY(step) })),
        color: sampleColormap(colormap, t),
      };
    }),
    pathOpacity,
    xDomain,
    baseValue: base,
    baseValueX: toX(base),
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    height: plotBottom + AXIS_HEIGHT,
  };
}
