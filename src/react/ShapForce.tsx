import { useMemo, useState } from "react";
import { Explanation, ParsedExplanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { forceLayout } from "../core/forceLayout";
import { formatFeatureLabel, formatLevel, formatShapValue } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { forceTableRows } from "../core/tableRows";
import { GLYPH_PX, TOOLTIP_LINE_HEIGHT, TooltipRun, placeTooltip, runsToText } from "../core/tooltip";
import { ChartTable } from "./ChartTable";


export function abbreviateBinomialLabel(label: string, isOtherRow: boolean): string | null {
  if (isOtherRow) return null;
  const words = formatFeatureLabel(label).trim().split(/\s+/);
  return words.length === 2 ? `${words[0][0]}. ${words[1]}` : null;
}

function estimateTextWidth(text: string): number {
  return text.length * GLYPH_PX.body;
}

export function forceSegmentLabel(
  label: string,
  isOtherRow: boolean,
  segmentWidth: number,
): string | null {
  const full = formatFeatureLabel(label);
  if (estimateTextWidth(full) <= segmentWidth) return full;
  const abbreviated = abbreviateBinomialLabel(full, isOtherRow);
  return abbreviated !== null && estimateTextWidth(abbreviated) <= segmentWidth
    ? abbreviated
    : null;
}

function clampTextX(
  x: number,
  text: string,
  anchor: "start" | "middle" | "end",
  chartWidth: number,
): number {
  const textWidth = estimateTextWidth(text);
  const minimum = anchor === "middle" ? textWidth / 2 : anchor === "end" ? textWidth : 0;
  const maximum = anchor === "middle"
    ? chartWidth - textWidth / 2
    : anchor === "start" ? chartWidth - textWidth : chartWidth;
  return Math.max(minimum, Math.min(x, maximum));
}


/**
 * What a hovered segment says.
 *
 * A bare number told a reader nothing: the segments are unlabelled wherever the
 * name does not fit, which is most of them, so hovering has to supply the name
 * as well as the value. The abundance comes too — a contribution is only
 * readable next to how much of the taxon was actually there.
 */
export function forceTooltipLines(
  parsed: ParsedExplanation,
  sampleIndex: number,
  segment: { label: string; featureIndex: number | null; isOtherRow: boolean; value: number },
  words: PlotLabels,
): TooltipRun[][] {
  // The Other features row is a count, not a taxon, so it stays upright.
  const lines: TooltipRun[][] = [
    segment.isOtherRow
      ? [{ text: segment.label }]
      : [{ text: formatFeatureLabel(segment.label), italic: true }],
    [{ text: `${words.shapValue}: ${formatShapValue(segment.value)}` }],
  ];
  if (segment.featureIndex !== null) {
    const value = parsed.data[sampleIndex][segment.featureIndex];
    lines.push([
      { text: `${words.featureValue}: ${value > 0 ? formatLevel(value) : words.absent}` },
    ]);
  }
  return lines;
}

export type ShapForceProps = {
  explanation: Explanation;
  sampleIndex?: number;
  maxDisplay?: number;
  faithfulOtherRow?: boolean;
  groupByGenus?: boolean;
  classIndex?: number;
  width?: number;
  height?: number;
  tableView?: TableView;
  labels?: Partial<PlotLabels>;
};

export function ShapForce({
  explanation,
  sampleIndex = 0,
  maxDisplay = 10,
  faithfulOtherRow = false,
  groupByGenus = false,
  classIndex = 1,
  width = 720,
  height = 96,
  tableView = "hidden",
  labels,
}: ShapForceProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const { layout, table, parsed } = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const layout = forceLayout({
      parsed, sampleIndex, width, height, maxDisplay, faithfulOtherRow, labels: words,
    });
    return { layout, table: forceTableRows(layout, words), parsed };
  }, [explanation, sampleIndex, maxDisplay, faithfulOtherRow, groupByGenus, classIndex,
      width, height, words]);

  const modelOutputLabel = `${words.modelOutput} ${formatLevel(layout.modelOutput)}`;
  const modelOutputX = clampTextX(layout.meetingX, modelOutputLabel, "middle", width);
  const higherX = clampTextX(layout.meetingX - 8, words.higher, "end", width);
  const lowerX = clampTextX(layout.meetingX + 8, words.lower, "start", width);
  const baseValueX = clampTextX(layout.baseValueX, words.baseValue, "middle", width);

  const active = hovered === null ? null : layout.segments[hovered] ?? null;
  const tooltipLines: TooltipRun[][] = active
    ? forceTooltipLines(parsed, sampleIndex, active, words)
    : [];
  const tooltip = active
    ? placeTooltip({
        anchorX: active.x + active.width / 2,
        anchorY: layout.barY + layout.barHeight / 2,
        lines: tooltipLines.map(runsToText),
        lineHeight: TOOLTIP_LINE_HEIGHT,
        minWidth: 120,
        chartWidth: width,
        chartHeight: height,
      })
    : null;

  return (
    <>
      <svg width={width} height={height} role="img"
         aria-label={`${words.modelOutput} ${formatLevel(layout.modelOutput)} for ${
           words.sampleFallback(sampleIndex + 1)
         }`}>
      {layout.segments.map((segment, i) => {
        const segmentLabel = segment.labelled
          ? forceSegmentLabel(segment.label, segment.isOtherRow, segment.width)
          : null;
        return (
          <g key={`segment-${i}`}
             onMouseEnter={() => setHovered(i)}
             onMouseLeave={() => setHovered(null)}>
            <rect x={segment.x} y={layout.barY}
                  width={Math.max(0, segment.width - 2)} height={layout.barHeight}
                  fill={segment.color}
                  fillOpacity={hovered === null || hovered === i ? 1 : 0.5} />
            {segmentLabel !== null && (
              <text x={segment.x + segment.width / 2} y={layout.barY + layout.barHeight / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fill="#ffffff"
                    fontStyle={segment.isOtherRow ? "normal" : "italic"}>
                {segmentLabel}
              </text>
            )}
          </g>
        );
      })}
      <line x1={layout.meetingX} x2={layout.meetingX}
            y1={layout.barY - 6} y2={layout.barY + layout.barHeight + 6}
            stroke="#333333" strokeWidth={2} />
      <text x={modelOutputX} y={layout.barY - 10} textAnchor="middle"
            fontSize={12} fill="#333333">
        {modelOutputLabel}
      </text>
      <text x={higherX} y={layout.barY + layout.barHeight + 16}
            textAnchor="end" fontSize={11} fill="#666666">
        {words.higher}
      </text>
      <text x={lowerX} y={layout.barY + layout.barHeight + 16}
            textAnchor="start" fontSize={11} fill="#666666">
        {words.lower}
      </text>
      <line x1={layout.baseValueX} x2={layout.baseValueX}
            y1={layout.barY + layout.barHeight} y2={layout.barY + layout.barHeight + 8}
            stroke="#999999" strokeWidth={1} />
      <text x={baseValueX} y={layout.barY + layout.barHeight + 22}
            textAnchor="middle" fontSize={11} fill="#666666">
        {words.baseValue}
      </text>
      {tooltip && tooltipLines.length > 0 && (
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
