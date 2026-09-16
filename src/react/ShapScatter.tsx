import { useMemo, useState } from "react";
import { Explanation, ParsedExplanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { ColormapName, sampleColormap } from "../core/colormap";
import { strongestInteraction } from "../core/interactions";
import { binnedMedianTrend, logDomain, scatterPoints } from "../core/scatterLayout";
import { formatFeatureLabel, formatLevel, formatShapValue } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { AXIS_TITLE_DY, niceTicks, tickLabel, tickSpace } from "../core/ticks";
import { scatterTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";
import { colorBarLayout, ColorBarGeometry } from "../core/colorBar";
import { ColorBar } from "./ColorBar";

const MARGIN = { left: 70, right: 24, top: 16, bottom: 56 };
/** Width reserved for the Absent band, and the gap that separates it. */
const ABSENT_BAND = 56;
const ABSENT_GAP = 18;
const DOT_RADIUS = 4;
const TICK_LABEL_PT = 11;
const UNCOLOURED = "#1f77b4";

export type ScatterGeometryInput = {
  parsed: ParsedExplanation;
  featureIndex: number;
  width: number;
  height: number;
  colorFeature: number | "auto" | "none";
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
  absentLabel: string | null;
  absentMeanY: number | null;
  zeroRuleY: number;
  trendPath: string | null;
  colorFeatureIndex: number | null;
  colorFeatureLabel: string | null;
  colorNote: string;
  colorBar: ColorBarGeometry | null;
  xTicks: { x: number; label: string }[];
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  xTitle: { text: string; x: number; y: number };
  yTitle: string;
};

/** Pure geometry, exported so it can be tested without rendering. */
export function scatterGeometry(input: ScatterGeometryInput): ScatterGeometry {
  const {
    parsed, featureIndex, width, height, colorFeature, colorFeatureMinScore, colorBar = true,
    xScale, trend, colormap = "red_blue",
  } = input;
  const words = input.labels ?? resolveLabels();

  const { absent, detected } = scatterPoints(parsed, featureIndex);
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;
  const plotLeft = MARGIN.left;
  const plotRight = width - (colorBar ? 90 : MARGIN.right);
  const detectedLeft = absent.length > 0 ? plotLeft + ABSENT_BAND + ABSENT_GAP : plotLeft;

  const shapValues = parsed.values.map((row) => row[featureIndex]);
  const shapMin = Math.min(0, ...shapValues);
  const shapMax = Math.max(0, ...shapValues);
  const shapSpan = shapMax - shapMin || 1;
  const toY = (shap: number) => plotBottom - ((shap - shapMin) / shapSpan) * (plotBottom - plotTop);

  const [lowValue, highValue] = logDomain(detected);
  const useLog = xScale === "log" && lowValue > 0;
  const scaleOf = (v: number) => (useLog ? Math.log10(v) : v);
  const lowScaled = scaleOf(lowValue);
  const highScaled = scaleOf(highValue);
  const scaledSpan = highScaled - lowScaled || 1;
  const toX = (v: number) =>
    detectedLeft + ((scaleOf(v) - lowScaled) / scaledSpan) * (plotRight - detectedLeft);

  // Colour Feature: SHAP's automatic pick, but only used when it is strong.
  let colorFeatureIndex: number | null = null;
  let colorNote = "";
  if (colorFeature === "auto") {
    const best = strongestInteraction(featureIndex, parsed.values, parsed.data);
    if (best && best.score >= colorFeatureMinScore) {
      colorFeatureIndex = best.index;
      colorNote = words.interactionScore(best.score);
    } else {
      colorNote = words.weakInteraction;
    }
  } else if (typeof colorFeature === "number" && colorFeature !== featureIndex) {
    colorFeatureIndex = colorFeature;
  }

  // SHAP clips the colour scale to the 5th and 95th percentiles.
  let colorLow = 0;
  let colorHigh = 1;
  if (colorFeatureIndex !== null) {
    const column = parsed.data.map((row) => row[colorFeatureIndex as number]).sort((a, b) => a - b);
    const at = (q: number) => column[Math.min(column.length - 1, Math.floor(q * column.length))];
    colorLow = at(0.05);
    colorHigh = at(0.95);
    if (colorLow === colorHigh) {
      colorLow = column[0];
      colorHigh = column[column.length - 1];
    }
  }
  const colorOf = (sampleIndex: number) => {
    if (colorFeatureIndex === null) return UNCOLOURED;
    const value = parsed.data[sampleIndex][colorFeatureIndex];
    const t = colorHigh === colorLow ? 0.5 : (value - colorLow) / (colorHigh - colorLow);
    return sampleColormap(colormap, t);
  };
  const colorFeatureLabel = colorFeatureIndex === null
    ? null
    : formatFeatureLabel(parsed.featureNames[colorFeatureIndex]);
  const colorBarGeometry = colorFeatureIndex === null || !colorBar
    ? null
    : colorBarLayout({
        colormap,
        tickLabels: [words.featureValueLow, words.featureValueHigh],
        label: words.featureValue,
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
    absentLabel: absent.length > 0 ? words.absentWithCount(absent.length) : null,
    absentMeanY,
    zeroRuleY: toY(0),
    trendPath,
    colorFeatureIndex,
    colorFeatureLabel,
    colorNote,
    colorBar: colorBarGeometry,
    xTicks,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    xTitle: {
      text: formatFeatureLabel(parsed.featureNames[featureIndex]),
      x: (plotLeft + plotRight) / 2,
      y: plotBottom + AXIS_TITLE_DY,
    },
    yTitle: words.shapValue,
  };
}

export type ShapScatterProps = {
  explanation: Explanation;
  /** Which Feature to draw, by name or index. Required — there is no default. */
  feature: string | number;
  colorFeature?: string | number | "auto" | "none";
  /** Below this mean |r|, the chart draws in one hue and says why. */
  colorFeatureMinScore?: number;
  xScale?: "log" | "linear";
  trend?: boolean;
  groupByGenus?: boolean;
  classIndex?: number;
  width?: number;
  height?: number;
  colormap?: ColormapName;
  /** SHAP's Low–High Feature value colour bar. */
  colorBar?: boolean;
  tableView?: TableView;
  labels?: Partial<PlotLabels>;
  onSampleClick?: (sampleIndex: number) => void;
};

export function ShapScatter({
  explanation,
  feature,
  colorFeature = "auto",
  colorFeatureMinScore = 0.2,
  xScale = "log",
  trend = true,
  groupByGenus = false,
  classIndex = 1,
  width = 640,
  height = 400,
  colormap = "red_blue",
  colorBar = true,
  tableView = "hidden",
  labels,
  onSampleClick,
}: ShapScatterProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const { geometry, parsed, featureIndex, table } = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const p = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const indexOf = (f: string | number) =>
      typeof f === "number" ? f : p.featureNames.indexOf(f);
    const featureIndex = indexOf(feature);
    if (featureIndex < 0) {
      throw new RangeError(`unknown feature ${String(feature)}`);
    }
    const resolvedColor =
      colorFeature === "auto" || colorFeature === "none" ? colorFeature : indexOf(colorFeature);
    const split = scatterPoints(p, featureIndex);
    return {
      parsed: p,
      featureIndex,
      table: scatterTableRows(p, featureIndex, split, words),
      geometry: scatterGeometry({
        parsed: p,
        featureIndex,
        width,
        height,
        colorFeature: resolvedColor,
        colorFeatureMinScore,
        colorBar,
        xScale,
        trend,
        colormap,
        labels: words,
      }),
    };
  }, [explanation, feature, colorFeature, colorFeatureMinScore, colorBar, xScale, trend,
      groupByGenus, classIndex, width, height, colormap, words]);

  const dot = (p: { cx: number; cy: number; color: string; sampleIndex: number }, key: string) => (
    <circle
      key={key}
      cx={p.cx}
      cy={p.cy}
      r={DOT_RADIUS}
      fill={p.color}
      stroke={hovered === p.sampleIndex ? "#333333" : "none"}
      strokeWidth={1.5}
      onMouseEnter={() => setHovered(p.sampleIndex)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => onSampleClick?.(p.sampleIndex)}
      style={{ cursor: onSampleClick ? "pointer" : "default" }}
    />
  );

  return (
    <>
      <svg width={width} height={height} role="img"
         aria-label={`${words.shapValue} against ${geometry.xTitle.text}`}>
      <line x1={geometry.plotLeft} x2={geometry.plotRight}
            y1={geometry.zeroRuleY} y2={geometry.zeroRuleY}
            stroke="#888888" strokeWidth={0.5} strokeDasharray="1 5" />
      {geometry.absentLabel && (
        <text x={geometry.plotLeft + 4} y={geometry.plotBottom + 18} fontSize={11} fill="#333333">
          {geometry.absentLabel}
        </text>
      )}
      {geometry.absentMeanY !== null && (
        <line x1={geometry.plotLeft} x2={geometry.plotLeft + 48}
              y1={geometry.absentMeanY} y2={geometry.absentMeanY}
              stroke="#333333" strokeWidth={2} />
      )}
      {geometry.trendPath && (
        <path d={geometry.trendPath} fill="none" stroke="#333333" strokeWidth={2} />
      )}
      {geometry.absentPoints.map((p, i) => dot(p, `absent-${i}`))}
      {geometry.detectedPoints.map((p, i) => dot(p, `detected-${i}`))}
      {geometry.xTicks.map((t, i) => (
        <text key={`tick-${i}`} x={t.x} y={geometry.plotBottom + 18}
              textAnchor="middle" fontSize={11} fill="#333333">
          {t.label}
        </text>
      ))}
      <text x={geometry.xTitle.x} y={geometry.xTitle.y}
            textAnchor="middle" fontSize={13} fontStyle="italic" fill="#333333">
        {geometry.xTitle.text}
      </text>
      <text x={14} y={(geometry.plotTop + geometry.plotBottom) / 2}
            textAnchor="middle" fontSize={13} fill="#333333"
            transform={`rotate(-90 14 ${(geometry.plotTop + geometry.plotBottom) / 2})`}>
        {geometry.yTitle}
      </text>
      <text x={geometry.plotRight} y={geometry.plotTop + 4}
            textAnchor="end" fontSize={11} fill="#666666">
        {geometry.colorFeatureLabel && (
          <tspan fontStyle="italic">{geometry.colorFeatureLabel}</tspan>
        )}
        {geometry.colorFeatureLabel && geometry.colorNote ? " · " : ""}
        {geometry.colorNote}
      </text>
      {geometry.colorBar && <ColorBar bar={geometry.colorBar} />}
      {hovered !== null && (
        <title>
          {`${formatShapValue(parsed.values[hovered][featureIndex])}`}
        </title>
      )}
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
