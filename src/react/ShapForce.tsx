import { useMemo, useState } from "react";
import { Explanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { forceLayout } from "../core/forceLayout";
import { formatFeatureLabel, formatLevel, formatShapValue } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { forceTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";

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

  return (
    <>
      <svg width={width} height={height} role="img"
         aria-label={`${words.modelOutput} ${formatLevel(layout.modelOutput)} for ${
           words.sampleFallback(sampleIndex + 1)
         }`}>
      {layout.segments.map((segment, i) => (
        <g key={`segment-${i}`}
           onMouseEnter={() => setHovered(i)}
           onMouseLeave={() => setHovered(null)}>
          <rect x={segment.x} y={layout.barY}
                width={Math.max(0, segment.width - 2)} height={layout.barHeight}
                fill={segment.color}
                fillOpacity={hovered === null || hovered === i ? 1 : 0.5} />
          {segment.labelled && segment.width > 40 && (
            <text x={segment.x + segment.width / 2} y={layout.barY + layout.barHeight / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fill="#ffffff"
                  fontStyle={segment.isOtherRow ? "normal" : "italic"}>
              {formatFeatureLabel(segment.label)}
            </text>
          )}
        </g>
      ))}
      <line x1={layout.meetingX} x2={layout.meetingX}
            y1={layout.barY - 6} y2={layout.barY + layout.barHeight + 6}
            stroke="#333333" strokeWidth={2} />
      <text x={layout.meetingX} y={layout.barY - 10} textAnchor="middle"
            fontSize={12} fill="#333333">
        {`${words.modelOutput} ${formatLevel(layout.modelOutput)}`}
      </text>
      <text x={layout.meetingX - 8} y={layout.barY + layout.barHeight + 16}
            textAnchor="end" fontSize={11} fill="#666666">
        {words.higher}
      </text>
      <text x={layout.meetingX + 8} y={layout.barY + layout.barHeight + 16}
            textAnchor="start" fontSize={11} fill="#666666">
        {words.lower}
      </text>
      <line x1={layout.baseValueX} x2={layout.baseValueX}
            y1={layout.barY + layout.barHeight} y2={layout.barY + layout.barHeight + 8}
            stroke="#999999" strokeWidth={1} />
      <text x={layout.baseValueX} y={layout.barY + layout.barHeight + 22}
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
