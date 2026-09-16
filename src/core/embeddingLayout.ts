import { ParsedExplanation } from "./types";
import { shapPca } from "./pca";
import { ColormapName, sampleColormap } from "./colormap";
import { PlotLabels, resolveLabels } from "./labels";

/**
 * Samples positioned by *why* the model decided as it did.
 *
 * `shap.plots.embedding` runs a two-component PCA over the SHAP matrix rather
 * than over the Feature values, so Samples that landed in the same place for
 * the same reasons sit together. Two departures from it, both deliberate:
 * SHAP calls `plt.axis("off")` and throws the variance ratios away, and this
 * keeps both; and SHAP requires the colour Feature as its first argument, where
 * this defaults to Σφ — SHAP's own `"sum()"` option.
 */

const MARGIN = { left: 64, right: 24, top: 20, bottom: 52 };

export type EmbeddingPoint = { cx: number; cy: number; color: string; sampleIndex: number };

export type EmbeddingLayoutInput = {
  parsed: ParsedExplanation;
  width: number;
  height: number;
  /** Σφ, or a Feature index whose SHAP value colours the points. */
  colorBy: "sum" | "none" | number;
  /** Positions computed elsewhere — UMAP from Python, say. Skips the PCA. */
  coords?: [number, number][];
  colormap?: ColormapName;
  labels?: PlotLabels;
};

export type EmbeddingLayout = {
  points: EmbeddingPoint[];
  xTitle: string;
  yTitle: string;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
};

const UNCOLOURED = "#1f77b4";

export function embeddingLayout(input: EmbeddingLayoutInput): EmbeddingLayout {
  const { parsed, width, height, colorBy, coords, colormap = "red_blue" } = input;
  const words = input.labels ?? resolveLabels();

  if (coords && coords.length !== parsed.nSamples) {
    throw new RangeError(
      `coords must hold one position per Sample: expected ${parsed.nSamples}, received ${coords.length}`,
    );
  }

  const projection = coords ? null : shapPca(parsed.values);
  const positions = coords ?? projection!.coords;

  const plotLeft = MARGIN.left;
  const plotRight = width - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;

  const axisRange = (axis: 0 | 1): [number, number] => {
    const all = positions.map((p) => p[axis]);
    const low = Math.min(...all);
    const high = Math.max(...all);
    return low === high ? [low - 1, high + 1] : [low, high];
  };
  const [xLow, xHigh] = axisRange(0);
  const [yLow, yHigh] = axisRange(1);
  const toX = (v: number) => plotLeft + ((v - xLow) / (xHigh - xLow)) * (plotRight - plotLeft);
  const toY = (v: number) => plotBottom - ((v - yLow) / (yHigh - yLow)) * (plotBottom - plotTop);

  const colourValues =
    colorBy === "none"
      ? null
      : parsed.values.map((row) =>
          colorBy === "sum" ? row.reduce((sum, v) => sum + v, 0) : row[colorBy],
        );
  const colourLow = colourValues ? Math.min(...colourValues) : 0;
  const colourHigh = colourValues ? Math.max(...colourValues) : 1;

  const points: EmbeddingPoint[] = positions.map((position, i) => ({
    cx: toX(position[0]),
    cy: toY(position[1]),
    sampleIndex: i,
    color: colourValues
      ? sampleColormap(
          colormap,
          colourHigh === colourLow ? 0.5 : (colourValues[i] - colourLow) / (colourHigh - colourLow),
        )
      : UNCOLOURED,
  }));

  const title = (index: 1 | 2) =>
    projection
      ? words.principalComponent(index, projection.varianceRatios[index - 1])
      : `SHAP PC${index}`;

  return { points, xTitle: title(1), yTitle: title(2), plotLeft, plotRight, plotTop, plotBottom };
}
