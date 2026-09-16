import { useMemo, useState } from "react";
import { Explanation } from "../core/types";
import { parseExplanation } from "../core/parse";
import { groupExplanationByGenus } from "../core/taxonomy";
import { globalImportance, orderFeatures } from "../core/order";
import { collapseToDisplay } from "../core/collapse";
import { barLayout, clusteredOrder } from "../core/barLayout";
import { dendrogramCoords } from "../core/dendrogram";
import { formatLevel, formatShapValue } from "../core/format";
import { XAxis } from "./XAxis";
import { PlotLabels, resolveLabels } from "../core/labels";

export type ShapBarProps = {
  explanation: Explanation;
  maxDisplay?: number;
  faithfulOtherRow?: boolean;
  /** Collapse `Genus_species` Features into their genus before drawing. */
  groupByGenus?: boolean;
  classIndex?: number;
  width?: number;
  rowHeight?: number;
  /**
   * Wording for every piece of text the chart draws; keys not given keep SHAP's.
   * Pass a stable object (a module constant or a memo): a new one each render
   * recomputes the layout each render.
   */
  labels?: Partial<PlotLabels>;
  /**
   * Cluster the Features and draw the tree beside the bars. `false` is today's
   * behaviour. `"shap"` clusters on SHAP values, `"data"` on Feature values,
   * and a matrix is taken as a SciPy linkage — the shape `shap.plots.bar`
   * validates, so a tree computed in Python drops straight in.
   */
  clustering?: "shap" | "data" | number[][] | false;
  /** SHAP's own default. */
  clusteringCutoff?: number;
  onFeatureClick?: (featureIndex: number | null) => void;
};

export function ShapBar({
  explanation,
  maxDisplay = 10,
  faithfulOtherRow = false,
  groupByGenus = false,
  classIndex = 1,
  width = 720,
  rowHeight = 26,
  labels,
  clustering = false,
  clusteringCutoff = 0.5,
  onFeatureClick,
}: ShapBarProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const words = useMemo(() => resolveLabels(labels), [labels]);

  const layout = useMemo(() => {
    const raw = parseExplanation(explanation, { classIndex });
    const parsed = groupByGenus ? groupExplanationByGenus(raw) : raw;
    const importance = globalImportance(parsed);
    const importanceOrder = orderFeatures(importance);
    const clustered =
      clustering === false
        ? null
        : clusteredOrder({ parsed, importanceOrder, mode: clustering, cutoff: clusteringCutoff });
    const order = clustered ? clustered.order : importanceOrder;
    const rows = collapseToDisplay(
      parsed.featureNames, importance, order, maxDisplay, faithfulOtherRow, words,
    );
    const base = barLayout(rows, {
      width, rowHeight, marginLeft: 260, marginRight: clustered ? 150 : 90, marginTop: 8,
      labels: words,
    });
    return { ...base, clustered };
  }, [groupByGenus, explanation, maxDisplay, faithfulOtherRow, classIndex, width, rowHeight,
      words, clustering, clusteringCutoff]);

  return (
    <svg width={width} height={layout.height} role="img"
         aria-label={`Mean absolute ${words.shapValue} per feature`}>
      <line x1={layout.zeroLine.x} x2={layout.zeroLine.x}
            y1={layout.zeroLine.y1} y2={layout.zeroLine.y2}
            stroke="#333333" strokeWidth={1} />
      <XAxis ticks={layout.xTicks} spine={layout.xSpine} title={layout.xTitle}
             plotBottom={layout.plotBottom} tickFontSize={11} />
      {layout.bars.map((bar, i) => (
        <g key={`row-${i}`}
           onMouseEnter={() => setHovered(i)}
           onMouseLeave={() => setHovered(null)}
           onClick={() => onFeatureClick?.(bar.featureIndex)}
           style={{ cursor: onFeatureClick ? "pointer" : "default" }}>
          <rect x={0} y={bar.y - (rowHeight - bar.height) / 2}
                width={width} height={rowHeight}
                fill={hovered === i ? "#00000008" : "transparent"} />
          <text x={250} y={bar.centerY} textAnchor="end" dominantBaseline="middle"
                fontSize={13} fill="#333333"
                fontStyle={bar.isOtherRow ? "normal" : "italic"}>
            {bar.label}
          </text>
          <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height}
                fill={bar.color} stroke="rgba(255,255,255,0.8)" strokeWidth={1} />
          <text x={bar.x + bar.width + 6} y={bar.centerY} dominantBaseline="middle"
                fontSize={12} fill={bar.color}>
            {formatShapValue(bar.value)}
          </text>
        </g>
      ))}
      {layout.clustered && (() => {
        const leafPositions = layout.bars
          .filter((bar) => bar.featureIndex !== null)
          .map((bar) => bar.centerY);
        const segments = dendrogramCoords(leafPositions, layout.clustered.linkage)
          .filter((s) => s.xs.every((x) => Number.isFinite(x)));
        const heights = segments.flatMap((s) => s.ys);
        const tallest = Math.max(1e-9, ...heights);
        const treeLeft = width - 140;
        const treeWidth = 110;
        const toTreeX = (height: number) => treeLeft + (height / tallest) * treeWidth;
        const cutoffX = toTreeX(clusteringCutoff);
        return (
          <g>
            {segments.map((segment, i) => (
              <polyline key={`tree-${i}`}
                        points={segment.ys
                          .map((height, k) => `${toTreeX(height)},${segment.xs[k]}`)
                          .join(" ")}
                        fill="none" stroke="#999999" strokeWidth={1} />
            ))}
            <line x1={cutoffX} x2={cutoffX} y1={layout.zeroLine.y1} y2={layout.zeroLine.y2}
                  stroke="#cccccc" strokeWidth={1} strokeDasharray="3 3" />
            <text x={cutoffX} y={layout.zeroLine.y1 - 2} textAnchor="middle"
                  fontSize={10} fill="#999999">
              {`${words.clusterDistance} = ${formatLevel(clusteringCutoff, 2)}`}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
