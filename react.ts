import { ShapBar, type ShapBarProps } from "./src/react/ShapBar";
import { ShapBeeswarm, type ShapBeeswarmProps } from "./src/react/ShapBeeswarm";
import { ShapHeatmap, type ShapHeatmapProps } from "./src/react/ShapHeatmap";
import { ShapWaterfall, type ShapWaterfallProps } from "./src/react/ShapWaterfall";

/** Give a chart the name it is written as, so React DevTools shows `Plots.bar`. */
function named<T extends object>(component: T, displayName: string): T & { displayName: string } {
  return Object.assign(component, { displayName });
}

/**
 * The four charts, named the way shap names them in Python: `shap.plots.bar`
 * becomes `<Plots.bar />`.
 *
 * One import brings all four charts into a bundle, even on a page that draws
 * one — about 30 KB minified, against about 8 KB for a single chart, measured
 * with esbuild. That trade was chosen for the single import name.
 */
export const Plots = {
  bar: named(ShapBar, "Plots.bar"),
  beeswarm: named(ShapBeeswarm, "Plots.beeswarm"),
  heatmap: named(ShapHeatmap, "Plots.heatmap"),
  waterfall: named(ShapWaterfall, "Plots.waterfall"),
} as const;

export type BarPlotProps = ShapBarProps;
export type BeeswarmPlotProps = ShapBeeswarmProps;
export type HeatmapPlotProps = ShapHeatmapProps;
export type WaterfallPlotProps = ShapWaterfallProps;
