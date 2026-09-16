import { ParsedExplanation } from "./types";
import { interactionWindowSize } from "./interactions";

/**
 * Geometry for the dependence scatter.
 *
 * Microbiome abundance is zero-inflated, and D4 fixes that a zero is a true
 * biological zero rather than a missing reading. Drawn on one linear axis, the
 * undetected Samples pile into an opaque stripe that hides the very thing the
 * chart is for. So the Samples are split: those where the taxon was not
 * detected go into their own band, and the rest onto a log axis.
 *
 * SHAP already does this for a different case — `_scatter.py` draws NaN Feature
 * values as tick marks at the axis edge. This is the same device for zeros.
 */

export type ScatterPoint = {
  sampleIndex: number;
  /** Relative abundance. */
  value: number;
  /** That Sample's SHAP value for this Feature. */
  shap: number;
};

export type ScatterSplit = {
  /** value === 0, in Sample order. */
  absent: ScatterPoint[];
  /** value > 0, ascending by value. */
  detected: ScatterPoint[];
};

export type TrendPoint = { value: number; shap: number };

/** Below this a trend line would be drawing the points back to the reader. */
const MIN_TREND_SAMPLES = 4;
/** How far a single-valued domain is opened, so the axis has width. */
const FLAT_DOMAIN_FACTOR = 10;

export function scatterPoints(parsed: ParsedExplanation, featureIndex: number): ScatterSplit {
  const absent: ScatterPoint[] = [];
  const detected: ScatterPoint[] = [];

  for (let i = 0; i < parsed.nSamples; i++) {
    const point: ScatterPoint = {
      sampleIndex: i,
      value: parsed.data[i][featureIndex],
      shap: parsed.values[i][featureIndex],
    };
    (point.value > 0 ? detected : absent).push(point);
  }

  detected.sort((a, b) => a.value - b.value || a.sampleIndex - b.sampleIndex);
  return { absent, detected };
}

export function logDomain(detected: ScatterPoint[]): [number, number] {
  if (detected.length === 0) return [1, 10];
  const low = detected[0].value;
  const high = detected[detected.length - 1].value;
  if (low === high) return [low / FLAT_DOMAIN_FACTOR, high * FLAT_DOMAIN_FACTOR];
  return [low, high];
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * The median SHAP value per window of sorted abundance.
 *
 * A median rather than a smoother: it takes no bandwidth parameter, needs no
 * dependency, and cannot invent a curve the data does not contain — which
 * matters when a reader will carry the shape into a biological claim. The
 * window is the one `approximate_interactions` uses, so a single constant
 * governs both.
 */
export function binnedMedianTrend(detected: ScatterPoint[]): TrendPoint[] {
  if (detected.length < MIN_TREND_SAMPLES && detected.length !== 2) return [];
  const window = interactionWindowSize(detected.length);
  const out: TrendPoint[] = [];

  for (let start = 0; start < detected.length; start += window) {
    const slice = detected.slice(start, start + window);
    if (slice.length === 0) continue;
    out.push({
      value: median(slice.map((p) => p.value)),
      shap: median([...slice.map((p) => p.shap)].sort((a, b) => a - b)),
    });
  }
  return out;
}
