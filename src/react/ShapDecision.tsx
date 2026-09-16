import { useMemo, useState } from "react";
import { Explanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { decisionLayout } from "../core/decisionLayout";
import { ColormapName } from "../core/colormap";
import { formatFeatureLabel, formatLevel } from "../core/format";
import { PlotLabels, resolveLabels } from "../core/labels";

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
  labels,
  onSampleClick,
}: ShapDecisionProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const layout = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    return decisionLayout({ parsed, width, rowHeight, maxDisplay, sampleIndices, colormap });
  }, [explanation, maxDisplay, sampleIndices, groupByGenus, classIndex, width, rowHeight, colormap]);

  return (
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
    </svg>
  );
}
