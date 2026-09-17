/**
 * Every piece of text the charts draw, keyed by what it means rather than where
 * it appears, so a word used in two places is changed once.
 *
 * The defaults are SHAP 0.49.1's own wording: a chart given no labels reads the
 * way SHAP's figures do.
 */
import { formatFixed } from "./format";

export type PlotLabels = {
  /** The value itself, as the beeswarm tooltip names it. */
  shapValue: string;
  /** The axis that measures it: beeswarm x axis and heatmap colour bar (_labels.py VALUE). */
  shapValueAxis: string;
  /** The bar chart's x axis. */
  meanAbsShapValue: string;
  /** A Feature's input value: beeswarm tooltip and colour bar title. */
  featureValue: string;
  /** The low end of the beeswarm colour bar. */
  featureValueLow: string;
  /** The high end of the beeswarm colour bar. */
  featureValueHigh: string;
  /** Written in place of a Feature value the payload does not have. */
  missingFeatureValue: string;
  /** The heatmap's Sample axis. */
  samples: string;
  /** A Sample's summed SHAP values, in the heatmap tooltip. */
  sampleTotal: string;
  /** A Sample the payload gives no label, numbered from 1. */
  sampleFallback: (sampleNumber: number) => string;
  /** The waterfall's starting point, E[f(X)]. */
  baseValue: string;
  /** The waterfall's end point, f(x). */
  modelOutput: string;
  /** Direction of positive SHAP values in the force plot. */
  higher: string;
  /** Direction of negative SHAP values in the force plot. */
  lower: string;
  /**
   * The row standing in for every Feature not shown. `style` is "sum" for the
   * bar, beeswarm and heatmap row in faithfulOtherRow mode, which SHAP titles as
   * a sum, and "count" everywhere else.
   */
  otherFeatures: (count: number, style: "sum" | "count") => string;
  /** The scatter's band for Samples where the taxon was not detected. */
  absent: string;
  /** The same band's tick, carrying how many Samples are in it. */
  absentWithCount: (count: number) => string;
  /** An embedding axis. `index` counts from 1; `varianceRatio` is 0–1. */
  principalComponent: (index: number, varianceRatio: number) => string;
  /** The decision plot's x axis: where each Sample's path ends. */
  cumulativeShapValue: string;
  /** The clustered bar's dendrogram cutoff. */
  clusterDistance: string;
  /** How strongly the scatter's colour Feature interacts, 0–1. */
  interactionScore: (score: number) => string;
  /** Said instead, when the strongest interaction is below the threshold. */
  weakInteraction: string;
  /** The scatter's trend line, in its legend and its table. */
  trend: string;
  /** The caption on a chart's table view. */
  tableCaption: string;
  /**
   * Said under an embedding axis when that component turns out to track a
   * Sample's summed SHAP values. `r` is the correlation, always at least the
   * threshold the chart applies.
   */
  componentTracksTotal: (r: number) => string;
  /**
   * The colour scale's title, built from what it encodes. The word matters:
   * a rotated title down the right edge is exactly where a second y axis would
   * be, so without it a reader takes the scale for an axis.
   */
  colorScale: (what: string) => string;
  /**
   * An embedding axis whose positions came from outside the chart, where a
   * variance share would be meaningless — and where calling the axis a
   * principal component would be a claim the chart cannot make.
   */
  suppliedComponent: (index: number) => string;
};

export const shapLabels: PlotLabels = {
  shapValue: "SHAP value",
  shapValueAxis: "SHAP value (impact on model output)",
  meanAbsShapValue: "mean(|SHAP value|)",
  featureValue: "Feature value",
  featureValueLow: "Low",
  featureValueHigh: "High",
  missingFeatureValue: "missing",
  samples: "Instances",
  sampleTotal: "Σφ",
  sampleFallback: (sampleNumber) => `Sample ${sampleNumber}`,
  baseValue: "E[f(X)]",
  modelOutput: "f(x)",
  higher: "higher",
  lower: "lower",
  otherFeatures: (count, style) =>
    style === "sum" ? `Sum of ${count} other features` : `${count} other features`,
  absent: "Absent",
  absentWithCount: (count) => `Absent (n = ${count})`,
  principalComponent: (index, varianceRatio) =>
    `SHAP PC${index} (${formatFixed(varianceRatio * 100, 0)}% of SHAP variance)`,
  cumulativeShapValue: "Model output",
  clusterDistance: "Clustering cutoff",
  interactionScore: (score) => `interaction ${formatFixed(score, 2)}`,
  weakInteraction: "no strong interaction found",
  trend: "Median trend",
  tableCaption: "Chart data",
  componentTracksTotal: (r) => `tracks Σφ, r = ${formatFixed(r, 2)}`,
  colorScale: (what) => `Colour: ${what}`,
  suppliedComponent: (index) => `Dimension ${index}`,
};

/** The given wording over SHAP's. A key given as undefined keeps the default. */
export function resolveLabels(labels?: Partial<PlotLabels>): PlotLabels {
  if (!labels) return shapLabels;
  const resolved: PlotLabels = { ...shapLabels };
  for (const key of Object.keys(labels) as (keyof PlotLabels)[]) {
    const value = labels[key];
    if (value !== undefined) (resolved as Record<keyof PlotLabels, unknown>)[key] = value;
  }
  return resolved;
}
