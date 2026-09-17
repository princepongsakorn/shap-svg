import { useMemo, useState } from "react";
import { Explanation, ParsedExplanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { decisionLayout } from "../core/decisionLayout";
import { ColormapName } from "../core/colormap";
import { formatFeatureLabel, formatLevel } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";
import { decisionTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";
import { TOOLTIP_LINE_HEIGHT, placeTooltip } from "../core/tooltip";


export function decisionTooltipLines(
  parsed: ParsedExplanation,
  sampleIndex: number,
  modelOutput: number,
  words: PlotLabels,
): string[] {
  return [
    parsed.sampleLabels?.[sampleIndex] ?? words.sampleFallback(sampleIndex + 1),
    `${words.cumulativeShapValue}: ${formatLevel(modelOutput)}`,
  ];
}

export type ShapDecisionProps = {
  explanation: Explanation;
  maxDisplay?: number;
  sampleIndices?: number[];
  groupByGenus?: boolean;
  classIndex?: number;
  width?: number;
  rowHeight?: number;
  colormap?: ColormapName;
  tableView?: TableView;
  labels?: Partial<PlotLabels>;
  onSampleClick?: (sampleIndex: number) => void;
};

export function ShapDecision({
  explanation,
  maxDisplay = 15,
  sampleIndices,
  groupByGenus = false,
  classIndex = 1,
  width = 720,
  rowHeight = 26,
  colormap = "red_blue",
  tableView = "hidden",
  labels,
  onSampleClick,
}: ShapDecisionProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const { layout, parsed, table } = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const layout = decisionLayout({ parsed, width, rowHeight, maxDisplay, sampleIndices, colormap });
    return { layout, parsed, table: decisionTableRows(layout, parsed, words) };
  }, [explanation, maxDisplay, sampleIndices, groupByGenus, classIndex, width, rowHeight, colormap,
      words]);

  const activePath = hovered === null
    ? null
    : layout.paths.find((path) => path.sampleIndex === hovered) ?? null;
  const activePoint = activePath?.points[activePath.points.length - 1];
  const modelOutput = activePath?.values[activePath.values.length - 1];
  const tooltipLines = hovered === null || modelOutput === undefined
    ? []
    : decisionTooltipLines(parsed, hovered, modelOutput, words);
  const tooltip = activePoint
    ? placeTooltip({
        anchorX: activePoint.x, anchorY: activePoint.y, lines: tooltipLines,
        lineHeight: TOOLTIP_LINE_HEIGHT, minWidth: 160,
        chartWidth: width, chartHeight: layout.height,
      })
    : null;

  return (
    <>
      <svg width={width} height={layout.height} role="img"
         aria-label={`${words.cumulativeShapValue} per Sample across features`}>
      <line x1={layout.baseValueX} x2={layout.baseValueX}
            y1={layout.plotTop} y2={layout.plotBottom}
            stroke="#999999" strokeWidth={1} />
      {layout.paths.map((path) => (
        <polyline
          key={`sample-${path.sampleIndex}`}
          points={path.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={path.color}
          strokeWidth={hovered === path.sampleIndex ? 2 : 1}
          strokeOpacity={hovered === null || hovered === path.sampleIndex ? layout.pathOpacity : 0.05}
          onMouseEnter={() => setHovered(path.sampleIndex)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSampleClick?.(path.sampleIndex)}
          style={{ cursor: onSampleClick ? "pointer" : "default" }}
        />
      ))}
      {layout.rowLabels.map((label, i) => (
        <text key={`row-${i}`} x={layout.plotLeft - 10} y={layout.rowY[i]}
              textAnchor="end" dominantBaseline="middle"
              fontSize={13} fontStyle="italic" fill="#333333">
          {formatFeatureLabel(label)}
        </text>
      ))}
      <text x={layout.baseValueX} y={layout.plotBottom + 18}
            textAnchor="middle" fontSize={11} fill="#666666">
        {`${words.baseValue} ${formatLevel(layout.baseValue)}`}
      </text>
      <text x={(layout.plotLeft + layout.plotRight) / 2} y={layout.plotBottom + 38}
            textAnchor="middle" fontSize={13} fill="#333333">
        {words.cumulativeShapValue}
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
