import { useMemo, useState } from "react";
import { Explanation, TableView } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { embeddingLayout } from "../core/embeddingLayout";
import { ColormapName } from "../core/colormap";
import { PlotLabels, resolveLabels } from "../core/labels";
import { embeddingTableRows } from "../core/tableRows";
import { ChartTable } from "./ChartTable";

const DOT_RADIUS = 4;

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
  tableView = "hidden",
  labels,
  onSampleClick,
}: ShapEmbeddingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const { layout, table } = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const resolvedColorBy =
      typeof colorBy === "string" && colorBy !== "sum" && colorBy !== "none"
        ? parsed.featureNames.indexOf(colorBy)
        : (colorBy as "sum" | "none" | number);
    const layout = embeddingLayout({
      parsed, width, height, colorBy: resolvedColorBy, coords, colormap, labels: words,
    });
    return { layout, table: embeddingTableRows(layout, parsed, words) };
  }, [explanation, colorBy, coords, groupByGenus, classIndex, width, height, colormap, words]);

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
      <text x={(layout.plotLeft + layout.plotRight) / 2} y={height - 14}
            textAnchor="middle" fontSize={13} fill="#333333">
        {layout.xTitle}
      </text>
      <text x={16} y={(layout.plotTop + layout.plotBottom) / 2}
            textAnchor="middle" fontSize={13} fill="#333333"
            transform={`rotate(-90 16 ${(layout.plotTop + layout.plotBottom) / 2})`}>
        {layout.yTitle}
      </text>
      </svg>
      <ChartTable data={table} view={tableView} />
    </>
  );
}
