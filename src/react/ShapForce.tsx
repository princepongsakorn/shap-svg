import { useMemo, useState } from "react";
import { Explanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { forceLayout } from "../core/forceLayout";
import { formatFeatureLabel, formatLevel, formatShapValue } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { forceTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";

/** Average advance of one glyph in the force chart's 11–12px text. */
const TEXT_CHAR_PX = 6.5;

export function abbreviateBinomialLabel(label: string, isOtherRow: boolean): string | null {
  if (isOtherRow) return null;
  const words = formatFeatureLabel(label).trim().split(/\s+/);
  return words.length === 2 ? `${words[0][0]}. ${words[1]}` : null;
}

function estimateTextWidth(text: string): number {
  return text.length * TEXT_CHAR_PX;
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

  const { layout, table } = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const layout = forceLayout({
      parsed, sampleIndex, width, height, maxDisplay, faithfulOtherRow, labels: words,
    });
    return { layout, table: forceTableRows(layout, words) };
  }, [explanation, sampleIndex, maxDisplay, faithfulOtherRow, groupByGenus, classIndex,
      width, height, words]);

  const modelOutputLabel = `${words.modelOutput} ${formatLevel(layout.modelOutput)}`;
  const modelOutputX = clampTextX(layout.meetingX, modelOutputLabel, "middle", width);
  const higherX = clampTextX(layout.meetingX - 8, words.higher, "end", width);
  const lowerX = clampTextX(layout.meetingX + 8, words.lower, "start", width);
  const baseValueX = clampTextX(layout.baseValueX, words.baseValue, "middle", width);

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
      {hovered !== null && (
        <title>{formatShapValue(layout.segments[hovered].value)}</title>
      )}
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
