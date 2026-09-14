/**
 * Every piece of text the charts draw, keyed by what it means rather than where
 * it appears, so a word used in two places is changed once.
 *
 * The defaults are SHAP 0.49.1's own wording: a chart given no labels reads the
 * way SHAP's figures do.
 */
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
  /**
   * The row standing in for every Feature not shown. `style` is "sum" for the
   * bar, beeswarm and heatmap row in faithfulOtherRow mode, which SHAP titles as
   * a sum, and "count" everywhere else.
   */
  otherFeatures: (count: number, style: "sum" | "count") => string;
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
  otherFeatures: (count, style) =>
    style === "sum" ? `Sum of ${count} other features` : `${count} other features`,
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
