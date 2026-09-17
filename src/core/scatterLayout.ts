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
 * The window comes from the same formula the interaction score uses, but over
 * the *detected* Samples rather than all of them — a trend over detected
 * Samples should be binned by how many of those there are. On zero-inflated
 * data the two window widths therefore differ, and deliberately.
 */
export function binnedMedianTrend(detected: ScatterPoint[]): TrendPoint[] {
  if (detected.length < MIN_TREND_SAMPLES) return [];
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

import { ColormapName, UNCOLOURED, sampleColormap } from "./colormap";
import { strongestInteraction } from "./interactions";
import { formatFeatureLabel, formatLevel, formatShapValue } from "./format";
import { PlotLabels, resolveLabels } from "./labels";
import { AXIS_TITLE_DY, niceTicks, tickLabel, tickSpace } from "./ticks";
import { colorBarLayout, ColorBarGeometry, colorScaleTitleParts } from "./colorBar";
import { GLYPH_PX, TooltipRun, namedValue } from "./tooltip";
import { sampleDisplayName } from "./parse";

const MARGIN = { right: 24, top: 16, bottom: 56 };
/** Width reserved for the Absent band, and the gap that separates it. */
export const ABSENT_BAND = 56;
/**
 * Space between the Absent band and the log axis. Wide enough that the band's
 * tick and the first abundance tick cannot touch: the band's label is centred
 * on a 56px band, so a narrower gap puts the two strings a pixel apart.
 */
const ABSENT_GAP = 40;
export const DOT_RADIUS = 4;
const TICK_LABEL_PT = 11;
const Y_TITLE_X = 14;

export type ScatterGeometryInput = {
  parsed: ParsedExplanation;
  featureIndex: number;
  width: number;
  height: number;
  colorFeature: number | "auto" | "none" | "output";
  colorFeatureMinScore: number;
  colorBar?: boolean;
  xScale: "log" | "linear";
  trend: boolean;
  colormap?: ColormapName;
  labels?: PlotLabels;
};

export type ScatterDot = { cx: number; cy: number; color: string; sampleIndex: number };

export type ScatterGeometry = {
  absentPoints: ScatterDot[];
  detectedPoints: ScatterDot[];
  /** The Absent band's tick, already wrapped to lines that fit under the band. */
  absentLabelLines: string[];
  absentMeanY: number | null;
  zeroRuleY: number;
  trendPath: string | null;
  colorFeatureIndex: number | null;
  colorFeatureLabel: string | null;
  colorNote: string;
  colorBar: ColorBarGeometry | null;
  xTicks: { x: number; label: string }[];
  yTicks: { value: number; y: number; label: string }[];
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  /**
   * `text` is the Feature's own name, drawn italic because it is a taxon.
   * `unit` says what the axis measures, which the name alone does not —
   * `shap.plots.scatter` labels this axis with the Feature name and nothing
   * else, which reads fine for "Age" and not at all for a species.
   */
  xTitle: { text: string; unit: string; x: number; y: number };
  yTitle: string;
  yTitleX: number;
};

const sampleName = (parsed: ParsedExplanation, sampleIndex: number, words: PlotLabels) =>
  sampleDisplayName(parsed, sampleIndex, words);

export function scatterTooltipLines(
  parsed: ParsedExplanation,
  sampleIndex: number,
  featureIndex: number,
  colorFeatureIndex: number | null,
  words: PlotLabels,
): TooltipRun[][] {
  const abundance = (index: number): TooltipRun[] => {
    const value = parsed.data[sampleIndex][index];
    return namedValue(
      formatFeatureLabel(parsed.featureNames[index]),
      value > 0 ? formatLevel(value) : words.absent,
    );
  };

  // The two taxa sit together. With the SHAP value between them the box read
  // as three unrelated facts; adjacent, the second line is plainly the taxon
  // being asked about and the third the one its colour encodes.
  const lines: TooltipRun[][] = [
    [{ text: sampleName(parsed, sampleIndex, words) }],
    abundance(featureIndex),
  ];
  if (colorFeatureIndex !== null) lines.push(abundance(colorFeatureIndex));
  lines.push([
    {
      text: `${words.shapValue}: ${formatShapValue(parsed.values[sampleIndex][featureIndex])}`,
    },
  ]);
  return lines;
}

/**
 * Break a label into lines that fit a given width, at spaces.
 *
 * The Absent band is narrow by design — it holds one column of points — so its
 * tick would otherwise run under the first abundance tick and the two would
 * print on top of each other. Wrapping at spaces rather than splitting the
 * label on a known format keeps this working for translated wording.
 */
export function wrapToWidth(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length * GLYPH_PX.axis > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Pure geometry, exported so it can be tested without rendering. */
export function scatterGeometry(input: ScatterGeometryInput): ScatterGeometry {
  const {
    parsed, featureIndex, width, height, colorFeature, colorFeatureMinScore, colorBar = true,
    xScale, trend, colormap = "red_blue",
  } = input;
  const words = input.labels ?? resolveLabels();

  const { absent, detected } = scatterPoints(parsed, featureIndex);
  const shapValues = parsed.values.map((row) => row[featureIndex]);
  const shapMin = Math.min(0, ...shapValues);
  const shapMax = Math.max(0, ...shapValues);
  const domainMin = shapMin === shapMax ? shapMin - 1 : shapMin;
  const domainMax = shapMin === shapMax ? shapMax + 1 : shapMax;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;
  const initialYTicks = niceTicks(
    domainMin, domainMax, tickSpace(plotBottom - plotTop, TICK_LABEL_PT),
  );
  const yStep = initialYTicks.step || 1;
  const yMin = Math.floor(domainMin / yStep) * yStep;
  const yMax = Math.ceil(domainMax / yStep) * yStep;
  const yTickValues = niceTicks(
    yMin, yMax, tickSpace(plotBottom - plotTop, TICK_LABEL_PT),
  ).ticks;
  const yTickLabel = (value: number) => {
    const normalized = Number(tickLabel(value, yStep).replace("−", "-"));
    return formatShapValue(value !== 0 && normalized === 0 ? value : normalized);
  };
  const widestYTick = Math.max(...yTickValues.map((value) => yTickLabel(value).length), 1)
    * GLYPH_PX.body;
  const plotLeft = Math.max(70, Y_TITLE_X + 13 + 8 + widestYTick + 8);
  const plotRight = width - (colorBar ? 90 : MARGIN.right);
  const detectedLeft = absent.length > 0 ? plotLeft + ABSENT_BAND + ABSENT_GAP : plotLeft;
  const shapSpan = yMax - yMin || 1;
  const toY = (shap: number) => plotBottom - ((shap - yMin) / shapSpan) * (plotBottom - plotTop);
  const yTicks = yTickValues.map((value) => ({ value, y: toY(value), label: yTickLabel(value) }));

  const [lowValue, highValue] = logDomain(detected);
  const useLog = xScale === "log" && lowValue > 0;
  const scaleOf = (v: number) => (useLog ? Math.log10(v) : v);
  const lowScaled = scaleOf(lowValue);
  const highScaled = scaleOf(highValue);
  const scaledSpan = highScaled - lowScaled || 1;
  const toX = (v: number) =>
    detectedLeft + ((scaleOf(v) - lowScaled) / scaledSpan) * (plotRight - detectedLeft);

  // What the dots are coloured by. Three modes, and the chart says which is in
  // force on the scale itself.
  //
  //  "auto"   a second Feature, the one SHAP's heuristic finds interacts most
  //           with the plotted one — used only when that heuristic is confident
  //  a number that Feature, chosen by the caller
  //  "output" each Sample's own Model output, so the cloud reads as the risk
  //           gradient it sits on rather than as one flat colour
  let colorFeatureIndex: number | null = null;
  let colorNote = "";
  let byOutput = false;
  if (colorFeature === "auto") {
    const best = strongestInteraction(featureIndex, parsed.values, parsed.data);
    if (best && best.score >= colorFeatureMinScore) {
      colorFeatureIndex = best.index;
      colorNote = words.interactionScore(best.score);
    } else {
      colorNote = words.weakInteraction;
    }
  } else if (colorFeature === "output") {
    byOutput = true;
  } else if (typeof colorFeature === "number" && colorFeature !== featureIndex) {
    colorFeatureIndex = colorFeature;
  }

  const outputs = parsed.values.map(
    (row, i) => parsed.baseValues[i] + row.reduce((sum, value) => sum + value, 0),
  );

  // SHAP clips the colour scale to the 5th and 95th percentiles.
  let colorLow = 0;
  let colorHigh = 1;
  const clipTo = (column: number[]) => {
    const sorted = [...column].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    colorLow = at(0.05);
    colorHigh = at(0.95);
    if (colorLow === colorHigh) {
      colorLow = sorted[0];
      colorHigh = sorted[sorted.length - 1];
    }
  };
  if (colorFeatureIndex !== null) {
    clipTo(parsed.data.map((row) => row[colorFeatureIndex as number]));
  } else if (byOutput) {
    clipTo(outputs);
  }

  const colorOf = (sampleIndex: number) => {
    if (colorFeatureIndex === null && !byOutput) return UNCOLOURED;
    const value = byOutput ? outputs[sampleIndex] : parsed.data[sampleIndex][colorFeatureIndex!];
    const t = colorHigh === colorLow ? 0.5 : (value - colorLow) / (colorHigh - colorLow);
    return sampleColormap(colormap, t);
  };

  const colorFeatureLabel = colorFeatureIndex === null
    ? null
    : formatFeatureLabel(parsed.featureNames[colorFeatureIndex]);

  // The scale's own title says what the colour means, and for the interaction
  // mode why that Feature was picked — two separate pieces of text made the
  // reader join them up. The taxon's name is set in italics, as it is on the x
  // axis and in every tooltip.
  const scaleSubject = colorFeatureLabel
    ? `${colorFeatureLabel} · ${words.featureValue}${colorNote ? ` (${colorNote})` : ""}`
    : words.modelOutput;
  // Only the taxon's name is italic — not the word that marks this a colour
  // scale, and not the quantity.
  const scaleParts = colorFeatureLabel
    ? colorScaleTitleParts(words.colorScale(scaleSubject), colorFeatureLabel)
    : undefined;
  const colorBarGeometry = (colorFeatureIndex === null && !byOutput) || !colorBar
    ? null
    : colorBarLayout({
        colormap,
        tickLabels: byOutput
          ? [formatLevel(colorLow), formatLevel(colorHigh)]
          : [words.featureValueLow, words.featureValueHigh],
        label: words.colorScale(scaleSubject),
        ...(scaleParts ? { labelParts: scaleParts } : {}),
        labelPad: 0,
      }, { x: plotRight + 18, y1: plotTop, y2: plotBottom });

  const absentCenter = plotLeft + ABSENT_BAND / 2;
  const absentPoints: ScatterDot[] = absent.map((p, i) => ({
    // Spread the band's points so identical SHAP values do not stack invisibly.
    cx: absentCenter + ((i % 5) - 2) * (DOT_RADIUS + 1),
    cy: toY(p.shap),
    color: colorOf(p.sampleIndex),
    sampleIndex: p.sampleIndex,
  }));
  const detectedPoints: ScatterDot[] = detected.map((p) => ({
    cx: toX(p.value),
    cy: toY(p.shap),
    color: colorOf(p.sampleIndex),
    sampleIndex: p.sampleIndex,
  }));

  const trendPoints = trend ? binnedMedianTrend(detected) : [];
  const trendPath =
    trendPoints.length >= 2
      ? trendPoints.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.value)},${toY(p.shap)}`).join(" ")
      : null;

  const absentMeanY =
    absent.length > 0 ? toY(absent.reduce((sum, p) => sum + p.shap, 0) / absent.length) : null;

  const { ticks, step } = niceTicks(
    lowScaled, highScaled, tickSpace(plotRight - detectedLeft, TICK_LABEL_PT),
  );
  const xTicks = ticks.map((t) => ({
    x: detectedLeft + ((t - lowScaled) / scaledSpan) * (plotRight - detectedLeft),
    label: useLog ? formatLevel(10 ** t) : tickLabel(t, step),
  }));

  return {
    absentPoints,
    detectedPoints,
    absentLabelLines:
      absent.length > 0
        ? wrapToWidth(words.absentWithCount(absent.length), ABSENT_BAND + ABSENT_GAP - 4)
        : [],
    absentMeanY,
    zeroRuleY: toY(0),
    trendPath,
    colorFeatureIndex,
    colorFeatureLabel,
    colorNote,
    colorBar: colorBarGeometry,
    xTicks,
    yTicks,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    xTitle: {
      unit: words.featureValue,
      text: formatFeatureLabel(parsed.featureNames[featureIndex]),
      x: (plotLeft + plotRight) / 2,
      y: plotBottom + AXIS_TITLE_DY,
    },
    yTitle: words.shapValue,
    yTitleX: Y_TITLE_X,
  };
}

