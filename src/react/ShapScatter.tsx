import { useMemo, useState } from "react";
import { Explanation, ParsedExplanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { ColormapName, UNCOLOURED, sampleColormap } from "../core/colormap";
import { strongestInteraction } from "../core/interactions";
import { binnedMedianTrend, logDomain, scatterPoints } from "../core/scatterLayout";
import { formatFeatureLabel, formatLevel, formatShapValue } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { AXIS_TITLE_DY, niceTicks, tickLabel, tickSpace } from "../core/ticks";
import { scatterTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";
import { colorBarLayout, ColorBarGeometry, colorScaleTitleParts } from "../core/colorBar";
import { ColorBar } from "./ColorBar";
import { GLYPH_PX, TOOLTIP_LINE_HEIGHT, TooltipRun, namedValue, placeTooltip, runsToText } from "../core/tooltip";

const MARGIN = { right: 24, top: 16, bottom: 56 };
/** Width reserved for the Absent band, and the gap that separates it. */
const ABSENT_BAND = 56;
/**
 * Space between the Absent band and the log axis. Wide enough that the band's
 * tick and the first abundance tick cannot touch: the band's label is centred
 * on a 56px band, so a narrower gap puts the two strings a pixel apart.
 */
const ABSENT_GAP = 40;
const DOT_RADIUS = 4;
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
  parsed.sampleLabels?.[sampleIndex] ?? words.sampleFallback(sampleIndex + 1);

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

export type ShapScatterProps = {
  explanation: Explanation;
  /** Which Feature to draw, by name or index. Required — there is no default. */
  feature: string | number;
  colorFeature?: string | number | "auto" | "none" | "output";
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
      colorFeature === "auto" || colorFeature === "none" || colorFeature === "output"
        ? colorFeature
        : indexOf(colorFeature);
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

  const activePoint = hovered === null
    ? null
    : [...geometry.absentPoints, ...geometry.detectedPoints]
        .find((point) => point.sampleIndex === hovered) ?? null;
  const tooltipLines = hovered === null || activePoint === null
    ? []
    : scatterTooltipLines(parsed, hovered, featureIndex, geometry.colorFeatureIndex, words);
  const tooltip = activePoint
    ? placeTooltip({
        anchorX: activePoint.cx,
        anchorY: activePoint.cy,
        lines: tooltipLines.map(runsToText),
        lineHeight: TOOLTIP_LINE_HEIGHT,
        minWidth: 160,
        chartWidth: width,
        chartHeight: height,
      })
    : null;

  return (
    <>
      <svg width={width} height={height} role="img"
         aria-label={`${words.shapValue} against ${geometry.xTitle.text}`}>
      <line x1={geometry.plotLeft} x2={geometry.plotRight}
            y1={geometry.zeroRuleY} y2={geometry.zeroRuleY}
            stroke="#888888" strokeWidth={0.5} strokeDasharray="1 5" />
      <g aria-hidden="true">
        <line data-axis-spine="left" x1={geometry.plotLeft} x2={geometry.plotLeft}
              y1={geometry.plotTop} y2={geometry.plotBottom} stroke="#333333" strokeWidth={1} />
        <line data-axis-spine="bottom" x1={geometry.plotLeft} x2={geometry.plotRight}
              y1={geometry.plotBottom} y2={geometry.plotBottom} stroke="#333333" strokeWidth={1} />
        {geometry.yTicks.map((tick) => (
          <g key={`y-tick-${tick.value}`}>
            <line x1={geometry.plotLeft - 5} x2={geometry.plotLeft}
                  y1={tick.y} y2={tick.y} stroke="#333333" strokeWidth={1} />
            <text x={geometry.plotLeft - 8} y={tick.y}
                  textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#333333">
              {tick.label}
            </text>
          </g>
        ))}
      </g>
      {geometry.absentLabelLines.map((line, index) => (
        <text key={`absent-line-${index}`}
              x={geometry.plotLeft + ABSENT_BAND / 2}
              y={geometry.plotBottom + 18 + index * 13}
              textAnchor="middle" fontSize={11} fill="#333333">
          {line}
        </text>
      ))}
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
            textAnchor="middle" fontSize={13} fill="#333333">
        <tspan fontStyle="italic">{geometry.xTitle.text}</tspan>
        <tspan> · {geometry.xTitle.unit}</tspan>
      </text>
      <text x={geometry.yTitleX} y={(geometry.plotTop + geometry.plotBottom) / 2}
            textAnchor="middle" fontSize={13} fill="#333333"
            transform={`rotate(-90 ${geometry.yTitleX} ${(geometry.plotTop + geometry.plotBottom) / 2})`}>
        {geometry.yTitle}
      </text>
      {/* No floating note: what the colour means, and why that Feature was
          chosen, both live on the colour scale itself. What is left up here is
          only the case where nothing could be coloured at all. */}
      {geometry.colorFeatureIndex === null && geometry.colorNote && (
        <text x={geometry.plotRight} y={geometry.plotTop + 4}
              textAnchor="end" fontSize={11} fill="#666666">
          {geometry.colorNote}
        </text>
      )}
      {/* One light panel around the strip, its ticks and its title.
          Apart, the rotated title sits exactly where a right-hand y axis title
          would and a reader takes it for one — which is what happened. Boxed,
          the three pieces read as the single key they are. */}
      {geometry.colorBar && (
        <rect
          x={geometry.colorBar.x - 10}
          y={geometry.plotTop - 10}
          width={geometry.colorBar.right - geometry.colorBar.x + 16}
          height={geometry.plotBottom - geometry.plotTop + 20}
          rx={4}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth={1}
        />
      )}
      {geometry.colorBar && <ColorBar bar={geometry.colorBar} />}
      {tooltip && (
        <g pointerEvents="none" transform={`translate(${tooltip.x} ${tooltip.y})`}>
          <rect x={0} y={0} width={tooltip.width} height={tooltip.height} rx={3}
                fill="#ffffff" stroke="#cccccc" />
          {tooltipLines.map((line, index) => (
            <text key={`tooltip-${index}`} x={7} y={16 + index * TOOLTIP_LINE_HEIGHT}
                  fontSize={11} fill="#222222">
              {line.map((run, runIndex) => (
                <tspan key={`run-${runIndex}`} fontStyle={run.italic ? "italic" : undefined}>
                  {run.text}
                </tspan>
              ))}
            </text>
          ))}
        </g>
      )}
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
