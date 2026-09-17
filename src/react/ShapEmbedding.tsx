import { useMemo, useState } from "react";
import { Explanation, ParsedExplanation, TableView } from "../core/types";
import { parseExplanation, sampleDisplayName } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { embeddingLayout } from "../core/embeddingLayout";
import { ColorBar, ColorKeyFrame } from "./ColorBar";
import { ColormapName } from "../core/colormap";
import { PlotLabels, resolveLabels } from "../core/labels";
import { embeddingTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";
import { HoverBox } from "./HoverBox";
import { formatFeatureLabel, formatLevel, formatShapValue } from "../core/format";
import { TOOLTIP_LINE_HEIGHT, TooltipRun, placeTooltip, runsToText } from "../core/tooltip";

const DOT_RADIUS = 4;
/** How many of a Sample's strongest SHAP values the hover box names. */
const TOOLTIP_TOP_FEATURES = 3;

export function embeddingTooltipLines(
  parsed: ParsedExplanation,
  sampleIndex: number,
  colorBy: "sum" | "none" | number,
  words: PlotLabels,
): TooltipRun[][] {
  const row = parsed.values[sampleIndex];
  const sum = row.reduce((total, value) => total + value, 0);
  const lines: TooltipRun[][] = [
    [{ text: sampleDisplayName(parsed, sampleIndex, words) }],
    // Where this Sample's prediction landed, which is what a reader is actually
    // after; Σφ alone is the distance travelled, not the destination.
    [{ text: `${words.modelOutput}: ${formatLevel(parsed.baseValues[sampleIndex] + sum)}` }],
    [{ text: `${words.sampleTotal}: ${formatShapValue(sum)}` }],
  ];

  if (typeof colorBy === "number") {
    lines.push([
      { text: formatFeatureLabel(parsed.featureNames[colorBy]), italic: true },
      { text: ` ${words.shapValue}: ${formatShapValue(row[colorBy])}` },
    ]);
  }

  // The Features that put this Sample where it is. Without them a point on this
  // map carries one number and no reason, which is the complaint this answers.
  const strongest = row
    .map((value, index) => ({ value, index }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.index - b.index)
    .slice(0, TOOLTIP_TOP_FEATURES);
  for (const { value, index } of strongest) {
    lines.push([
      { text: "  " },
      { text: formatFeatureLabel(parsed.featureNames[index]), italic: true },
      { text: ` ${formatShapValue(value)}` },
    ]);
  }
  return lines;
}

export type ShapEmbeddingProps = {
  explanation: Explanation;
  colorBy?: "sum" | "none" | string | number;
  /** Positions computed outside the browser; skips the PCA entirely. */
  coords?: [number, number][];
  groupByGenus?: boolean;
  classIndex?: number;
  width?: number;
  height?: number;
  colormap?: ColormapName;
  /** Draw the scale that says what the colour means. */
  colorBar?: boolean;
  tableView?: TableView;
  labels?: Partial<PlotLabels>;
  onSampleClick?: (sampleIndex: number) => void;
};

export function ShapEmbedding({
  explanation,
  colorBy = "sum",
  coords,
  groupByGenus = false,
  classIndex = 1,
  width = 620,
  height = 440,
  colormap = "red_blue",
  colorBar = true,
  tableView = "hidden",
  labels,
  onSampleClick,
}: ShapEmbeddingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const { layout, parsed, resolvedColorBy, table } = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const resolvedColorBy =
      typeof colorBy === "string" && colorBy !== "sum" && colorBy !== "none"
        ? parsed.featureNames.indexOf(colorBy)
        : (colorBy as "sum" | "none" | number);
    const layout = embeddingLayout({
      parsed, width, height, colorBy: resolvedColorBy, coords, colormap, colorBar, labels: words,
    });
    return { layout, parsed, resolvedColorBy, table: embeddingTableRows(layout, parsed, words) };
  }, [explanation, colorBy, coords, groupByGenus, classIndex, width, height, colormap, colorBar, words]);

  const activePoint = hovered === null
    ? null
    : layout.points.find((point) => point.sampleIndex === hovered) ?? null;
  const tooltipLines = hovered === null || activePoint === null
    ? []
    : embeddingTooltipLines(parsed, hovered, resolvedColorBy, words);
  const tooltip = activePoint
    ? placeTooltip({
        anchorX: activePoint.cx, anchorY: activePoint.cy,
        lines: tooltipLines.map(runsToText),
        lineHeight: TOOLTIP_LINE_HEIGHT, minWidth: 160, chartWidth: width, chartHeight: height,
      })
    : null;

  return (
    <>
      <svg width={width} height={height} role="img" aria-label={`${layout.xTitle}, ${layout.yTitle}`}>
      {layout.points.map((p) => (
        <circle
          key={`sample-${p.sampleIndex}`}
          cx={p.cx} cy={p.cy} r={DOT_RADIUS} fill={p.color}
          stroke={hovered === p.sampleIndex ? "#333333" : "none"} strokeWidth={1.5}
          onMouseEnter={() => setHovered(p.sampleIndex)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSampleClick?.(p.sampleIndex)}
          style={{ cursor: onSampleClick ? "pointer" : "default" }}
        />
      ))}
      <g aria-hidden="true">
        {layout.zeroX !== null && (
          <line x1={layout.zeroX} x2={layout.zeroX} y1={layout.plotTop} y2={layout.plotBottom}
                stroke="#cccccc" strokeWidth={1} strokeDasharray="3 4" />
        )}
        {layout.zeroY !== null && (
          <line x1={layout.plotLeft} x2={layout.plotRight} y1={layout.zeroY} y2={layout.zeroY}
                stroke="#cccccc" strokeWidth={1} strokeDasharray="3 4" />
        )}
        <line data-axis-spine="left" x1={layout.plotLeft} x2={layout.plotLeft}
              y1={layout.plotTop} y2={layout.plotBottom} stroke="#333333" strokeWidth={1} />
        <line data-axis-spine="bottom" x1={layout.plotLeft} x2={layout.plotRight}
              y1={layout.plotBottom} y2={layout.plotBottom} stroke="#333333" strokeWidth={1} />
      </g>
      {layout.colorBar && (
        <ColorKeyFrame bar={layout.colorBar} top={layout.plotTop} bottom={layout.plotBottom} />
      )}
      {layout.colorBar && <ColorBar bar={layout.colorBar} />}
      <text x={(layout.plotLeft + layout.plotRight) / 2} y={height - (layout.xMeaning ? 28 : 14)}
            textAnchor="middle" fontSize={13} fill="#333333">
        {layout.xTitle}
      </text>
      {layout.xMeaning && (
        <text x={(layout.plotLeft + layout.plotRight) / 2} y={height - 12}
              textAnchor="middle" fontSize={11} fill="#666666">
          {layout.xMeaning}
        </text>
      )}
      <text x={layout.yMeaning ? 16 : 16} y={(layout.plotTop + layout.plotBottom) / 2}
            textAnchor="middle" fontSize={13} fill="#333333"
            transform={`rotate(-90 16 ${(layout.plotTop + layout.plotBottom) / 2})`}>
        {layout.yTitle}
      </text>
      {layout.yMeaning && (
        <text x={30} y={(layout.plotTop + layout.plotBottom) / 2}
              textAnchor="middle" fontSize={11} fill="#666666"
              transform={`rotate(-90 30 ${(layout.plotTop + layout.plotBottom) / 2})`}>
          {layout.yMeaning}
        </text>
      )}
      {tooltip && <HoverBox box={tooltip} lines={tooltipLines} />}
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
