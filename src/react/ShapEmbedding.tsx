import { useMemo, useState } from "react";
import { Explanation, ParsedExplanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { embeddingLayout } from "../core/embeddingLayout";
import { ColorBar } from "./ColorBar";
import { ColormapName } from "../core/colormap";
import { PlotLabels, resolveLabels } from "../core/labels";
import { embeddingTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";
import { formatFeatureLabel, formatShapValue } from "../core/format";
import { placeTooltip } from "../core/tooltip";

const DOT_RADIUS = 4;
const TOOLTIP_LINE_HEIGHT = 15;

export function embeddingTooltipLines(
  parsed: ParsedExplanation,
  sampleIndex: number,
  colorBy: "sum" | "none" | number,
  words: PlotLabels,
): string[] {
  const lines = [parsed.sampleLabels?.[sampleIndex] ?? words.sampleFallback(sampleIndex + 1)];
  if (colorBy === "sum") {
    const sum = parsed.values[sampleIndex].reduce((total, value) => total + value, 0);
    lines.push(`${words.sampleTotal}: ${formatShapValue(sum)}`);
  } else if (typeof colorBy === "number") {
    lines.push(
      `${formatFeatureLabel(parsed.featureNames[colorBy])} ${words.shapValue}: ${
        formatShapValue(parsed.values[sampleIndex][colorBy])
      }`,
    );
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
        anchorX: activePoint.cx, anchorY: activePoint.cy, lines: tooltipLines,
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
      {layout.colorBar && <ColorBar bar={layout.colorBar} />}
      <text x={(layout.plotLeft + layout.plotRight) / 2} y={height - 14}
            textAnchor="middle" fontSize={13} fill="#333333">
        {layout.xTitle}
      </text>
      <text x={16} y={(layout.plotTop + layout.plotBottom) / 2}
            textAnchor="middle" fontSize={13} fill="#333333"
            transform={`rotate(-90 16 ${(layout.plotTop + layout.plotBottom) / 2})`}>
        {layout.yTitle}
      </text>
      {tooltip && (
        <g pointerEvents="none" transform={`translate(${tooltip.x} ${tooltip.y})`}>
          <rect x={0} y={0} width={tooltip.width} height={tooltip.height} rx={3}
                fill="#ffffff" stroke="#cccccc" />
          {tooltipLines.map((line, index) => (
            <text key={`tooltip-${index}`} x={7} y={16 + index * TOOLTIP_LINE_HEIGHT}
                  fontSize={11} fill="#222222">{line}</text>
          ))}
        </g>
      )}
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
