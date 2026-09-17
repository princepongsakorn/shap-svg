import { useMemo, useState } from "react";
import { Explanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { ColormapName } from "../core/colormap";
import { PlotLabels, resolveLabels } from "../core/labels";
import { TOOLTIP_LINE_HEIGHT, TooltipRun, placeTooltip, runsToText } from "../core/tooltip";
import {
  ABSENT_BAND,
  DOT_RADIUS,
  scatterGeometry,
  scatterPoints,
  scatterTooltipLines,
} from "../core/scatterLayout";
import { scatterTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";
import { HoverBox } from "./HoverBox";
import { ColorBar, ColorKeyFrame } from "./ColorBar";


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
      {geometry.colorBar && (
        <ColorKeyFrame bar={geometry.colorBar} top={geometry.plotTop} bottom={geometry.plotBottom} />
      )}
      {geometry.colorBar && <ColorBar bar={geometry.colorBar} />}
      {tooltip && <HoverBox box={tooltip} lines={tooltipLines} />}
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
