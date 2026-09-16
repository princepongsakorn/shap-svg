import { ParsedExplanation } from "./types";
import { shapPca } from "./pca";
import { ColormapName, sampleColormap } from "./colormap";
import { colorBarLayout, ColorBarGeometry } from "./colorBar";
import { formatFeatureLabel, formatShapValue } from "./format";
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
/** Room the colour bar and its rotated title need on the right. */
const COLOR_BAR_MARGIN = 96;

export type EmbeddingPoint = {
  cx: number;
  cy: number;
  /** Unscaled coordinates in the projection supplied to or computed by the layout. */
  coordinates: [number, number];
  color: string;
  sampleIndex: number;
};

export type EmbeddingLayoutInput = {
  parsed: ParsedExplanation;
  width: number;
  height: number;
  /** Σφ, or a Feature index whose SHAP value colours the points. */
  colorBy: "sum" | "none" | number;
  /** Positions computed elsewhere — UMAP from Python, say. Skips the PCA. */
  coords?: [number, number][];
  /** Draw the scale that says what the colour means. On unless colouring is off. */
  colorBar?: boolean;
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
  /** null when nothing is being encoded by colour. */
  colorBar: ColorBarGeometry | null;
};

const UNCOLOURED = "#1f77b4";

export function embeddingLayout(input: EmbeddingLayoutInput): EmbeddingLayout {
  const { parsed, width, height, colorBy, coords, colormap = "red_blue", colorBar = true } = input;
  const words = input.labels ?? resolveLabels();

  if (coords && coords.length !== parsed.nSamples) {
    throw new RangeError(
      `coords must hold one position per Sample: expected ${parsed.nSamples}, received ${coords.length}`,
    );
  }

  const projection = coords ? null : shapPca(parsed.values);
  const positions = coords ?? projection!.coords;

  const plotLeft = MARGIN.left;
  const showColorBar = colorBar && colorBy !== "none";
  const plotRight = width - (showColorBar ? COLOR_BAR_MARGIN : MARGIN.right);
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
    coordinates: position,
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

  // Without this the reader sees a blue-to-red gradient with nothing anywhere
  // saying what it measures, which is the one thing colour must never do.
  const colourLabel =
    colorBy === "sum"
      ? words.sampleTotal
      : typeof colorBy === "number"
        ? `${formatFeatureLabel(parsed.featureNames[colorBy])} · ${words.shapValue}`
        : "";

  return {
    points,
    xTitle: title(1),
    yTitle: title(2),
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    colorBar:
      showColorBar && colourValues
        ? colorBarLayout(
            {
              colormap,
              // The actual range, not "Low" and "High": these are signed
              // contributions and their sign is the thing worth reading.
              tickLabels: [formatShapValue(colourLow), formatShapValue(colourHigh)],
              label: colourLabel,
              labelPad: 0,
            },
            { x: plotRight + 18, y1: plotTop, y2: plotBottom },
          )
        : null,
  };
}
